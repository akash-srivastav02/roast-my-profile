import { NextRequest, NextResponse } from 'next/server';
import { fetchGitHubProfile } from '@/lib/github';
import { callLLM } from '@/lib/llm';
import { getSystemPrompt, buildGithubPrompt, buildLinkedinPrompt, buildResumePrompt } from '@/lib/prompts';
import { checkRateLimit } from '@/lib/ratelimit';
import { HttpError } from '@/lib/errors';
import type { RoastRequestBody, RoastResponse, StatRoasted } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_INPUT_LENGTH = 6000;
const GITHUB_USERNAME_RE = /^[A-Za-z0-9-]{1,39}$/;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

interface ParsedRoast {
  score?: number;
  verdict?: string;
  roast?: string;
  lines?: string[];
  stats_roasted?: StatRoasted[];
}

function parseRoastJson(text: string): ParsedRoast {
  try {
    const clean = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    return JSON.parse(clean);
  } catch {
    return {
      score: 42,
      verdict: 'Parse error extraordinaire',
      roast: text,
      lines: [],
      stats_roasted: [],
    };
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<RoastRequestBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That request was malformed JSON.' }, { status: 400 });
  }

  const { type, input, savage } = body;

  if (!type || !['github', 'linkedin', 'resume'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be one of: github, linkedin, resume.' },
      { status: 400 }
    );
  }
  if (!input || typeof input !== 'string' || !input.trim()) {
    return NextResponse.json({ error: 'Nothing to roast — input was empty.' }, { status: 400 });
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json(
      { error: `That text is too long. Keep it under ${MAX_INPUT_LENGTH.toLocaleString()} characters.` },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    const minutesLeft = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000 / 60));
    return NextResponse.json(
      {
        error: `You've used your ${limit.limit} free roasts for today. Come back in about ${minutesLeft} minutes for more.`,
      },
      { status: 429 }
    );
  }

  try {
    let label = '';
    let prompt = '';
    let fallbackStats: StatRoasted[] = [];

    if (type === 'github') {
      const username = input.trim().replace(/^@/, '');
      if (!GITHUB_USERNAME_RE.test(username)) {
        return NextResponse.json(
          { error: "That doesn't look like a valid GitHub username." },
          { status: 400 }
        );
      }
      const gh = await fetchGitHubProfile(username);
      label = '@' + gh.username;
      prompt = buildGithubPrompt(gh);
      fallbackStats = [
        { label: 'Total stars', value: String(gh.stars) },
        { label: 'Public repos', value: String(gh.publicRepos) },
        { label: 'Years active', value: gh.accountYears + 'y' },
      ];
    } else if (type === 'linkedin') {
      label = 'LinkedIn profile';
      prompt = buildLinkedinPrompt(input.trim());
    } else {
      label = 'Resume';
      prompt = buildResumePrompt(input.trim());
    }

    const raw = await callLLM(getSystemPrompt(!!savage), prompt);
    const parsed = parseRoastJson(raw);

    const result: RoastResponse = {
      score: clamp(parsed.score ?? 50, 1, 100),
      verdict: parsed.verdict || 'Unidentified developer',
      roast: parsed.roast || raw,
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      stats_roasted:
        Array.isArray(parsed.stats_roasted) && parsed.stats_roasted.length > 0
          ? parsed.stats_roasted
          : fallbackStats,
      label,
      type,
    };

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    if (e instanceof HttpError) {
      console.error('[roast api]', e.status, e.message);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : 'Something went wrong generating the roast.';
    console.error('[roast api] unexpected error', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
