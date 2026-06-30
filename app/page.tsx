'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoastResponse, RoastType } from '@/lib/types';

type TabId = 'github' | 'linkedin' | 'resume';

const LOADING_LINES: Record<TabId, string[]> = {
  github: [
    'Connecting to GitHub API...',
    'Counting abandoned side projects...',
    'Scanning commit history (mostly squashed bugs)...',
    'Tallying stars per year of effort...',
    'Preparing psychological damage report...',
  ],
  linkedin: [
    'Detecting buzzwords...',
    'Counting uses of "passionate"...',
    'Measuring synergy levels...',
    'Identifying humble-brags...',
    'Launching comedy missiles...',
  ],
  resume: [
    'Parsing resume...',
    'Verifying "fast learner" claim...',
    'Counting months of experience on a 3-page CV...',
    'Detecting "proficient in Microsoft Word"...',
    'Generating maximum damage report...',
  ],
};

const TAB_META: { id: TabId; label: string; icon: string }[] = [
  { id: 'github', label: 'GitHub', icon: '\u{1F419}' },
  { id: 'linkedin', label: 'LinkedIn', icon: '\u{1F4BC}' },
  { id: 'resume', label: 'Resume', icon: '\u{1F4C4}' },
];

const USAGE_KEY = 'rmp_usage_v1';
const DAILY_DISPLAY_CAP = 3;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function readUsage(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date: string; count: number };
    if (parsed.date !== todayStr()) return 0;
    return parsed.count;
  } catch {
    return 0;
  }
}

function bumpUsage(): number {
  const current = readUsage();
  const next = current + 1;
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify({ date: todayStr(), count: next }));
  } catch {
    // localStorage unavailable — ignore, server still enforces the real limit
  }
  return next;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>('github');
  const [ghUser, setGhUser] = useState('');
  const [liText, setLiText] = useState('');
  const [cvText, setCvText] = useState('');
  const [savage, setSavage] = useState<Record<TabId, boolean>>({
    github: false,
    linkedin: false,
    resume: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<RoastResponse | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy roast');
  const [dlLabel, setDlLabel] = useState('Download roast card as image');
  const [dlBusy, setDlBusy] = useState(false);
  const [usageToday, setUsageToday] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsageToday(readUsage());
  }, []);

  function switchTab(id: TabId) {
    setActiveTab(id);
    setErrorMsg(null);
    setResult(null);
    setShowCard(false);
  }

  function getInputForTab(tab: TabId): string {
    if (tab === 'github') return ghUser.trim();
    if (tab === 'linkedin') return liText.trim();
    return cvText.trim();
  }

  function resetAll() {
    setErrorMsg(null);
    setResult(null);
    setShowCard(false);
    setGhUser('');
    setLiText('');
    setCvText('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function roast() {
    setErrorMsg(null);
    setResult(null);
    setShowCard(false);

    const input = getInputForTab(activeTab);
    if (!input) {
      setErrorMsg(
        activeTab === 'github'
          ? 'Enter a GitHub username.'
          : activeTab === 'linkedin'
          ? 'Paste your LinkedIn text first.'
          : 'Paste your resume text first.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab as RoastType,
          input,
          savage: savage[activeTab],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong. Try again.');
      }

      setResult(data as RoastResponse);
      setUsageToday(bumpUsage());

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !barFillRef.current) return;
    const dmg = 100 - result.score;
    const el = barFillRef.current;
    el.style.width = '0%';
    el.style.background = dmg > 70 ? '#FF3D00' : dmg > 45 ? '#FF9800' : dmg > 20 ? '#FFE600' : '#00FF88';
    const t = setTimeout(() => {
      el.style.width = dmg + '%';
    }, 80);
    return () => clearTimeout(t);
  }, [result]);

  async function downloadCard() {
    if (!cardRef.current) return;
    setDlBusy(true);
    setDlLabel('Capturing card...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#0D0D0D',
        logging: false,
      });
      const link = document.createElement('a');
      const name = (result?.label || 'profile').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      link.download = `roast-card-${name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setDlLabel('Downloaded!');
      setTimeout(() => {
        setDlLabel('Download roast card as image');
        setDlBusy(false);
      }, 2200);
    } catch (e) {
      setErrorMsg('Card download failed: ' + (e instanceof Error ? e.message : 'unknown error'));
      setDlLabel('Download roast card as image');
      setDlBusy(false);
    }
  }

  function tweetIt() {
    if (!result) return;
    const txt = `I just got roasted by AI \u{1F525}\n\nVerdict: "${result.verdict}"\nDamage score: ${result.score}/100\n\nGet destroyed for free at roastmyprofile.dev`;
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  }

  function copyText() {
    if (!result) return;
    navigator.clipboard.writeText(result.roast).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy roast'), 2000);
    });
  }

  const remainingToday = Math.max(0, DAILY_DISPLAY_CAP - usageToday);
  const excerpt = result ? result.roast.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') : '';
  const typeLabels: Record<TabId, string> = {
    github: 'GitHub roast',
    linkedin: 'LinkedIn roast',
    resume: 'Resume roast',
  };

  return (
    <>
      <header className="hdr">
        <div className="logo">
          <span className="logo-fire">{'\u{1F525}'}</span>
          ROAST MY PROFILE
        </div>
        <span className="hdr-badge">
          <span className="dot" />
          Free, no sign-up
        </span>
      </header>

      <main className="wrap">
        <section className="hero" aria-label="Hero">
          <span className="hero-eyebrow">{'\u26A0'} Warning — brutal honesty ahead</span>
          <h1 className="hero-title">
            <span className="t1">GET YOUR</span>
            <span className="t2">PROFILE ROASTED</span>
          </h1>
          <p className="hero-sub">
            AI-powered comedy that reads your real GitHub data, LinkedIn buzzwords, and resume
            delusions — then absolutely destroys you. Powered by Claude. Free for everyone, no API
            key needed.
          </p>
          <div className="hero-pills">
            <span className="pill pill-r">{'\u{1F525}'} AI-powered</span>
            <span className="pill pill-c">{'\u26A1'} Real GitHub data</span>
            <span className="pill pill-g">{'\u{1F4F8}'} Shareable card</span>
            <span className="pill pill-y">{'\u{1F480}'} Savage mode</span>
          </div>
        </section>

        <div className="roast-box" role="region" aria-label="Roast interface">
          <div className="tabs" role="tablist">
            {TAB_META.map((t) => (
              <button
                key={t.id}
                className={`tab${activeTab === t.id ? ' on' : ''}`}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => switchTab(t.id)}
              >
                <span className="ti" aria-hidden="true">
                  {t.icon}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'github' && (
            <div className="pane">
              <label className="lbl" htmlFor="ghUser">
                GitHub username
              </label>
              <div className="inp-row">
                <span className="inp-pre">github.com /</span>
                <input
                  type="text"
                  id="ghUser"
                  placeholder="torvalds"
                  autoComplete="off"
                  spellCheck={false}
                  value={ghUser}
                  onChange={(e) => setGhUser(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && roast()}
                />
              </div>
              <p className="hint">
                Fetches your real repos, stars, languages, last commit date, bio and more via the
                public GitHub API — no auth needed. The more embarrassing the data, the better the
                roast.
              </p>
              <SavageToggle tab="github" checked={savage.github} onChange={setSavage} />
              <p className="usage-note">
                {remainingToday > 0
                  ? `${remainingToday} of ${DAILY_DISPLAY_CAP} free roasts left today`
                  : "You've used today's free roasts — come back tomorrow"}
              </p>
              <button className="fire-btn" onClick={roast} disabled={loading}>
                {'\u{1F525}'} {loading ? 'Roasting...' : 'Roast my GitHub'}
              </button>
            </div>
          )}

          {activeTab === 'linkedin' && (
            <div className="pane">
              <label className="lbl" htmlFor="liText">
                Paste your LinkedIn headline or about section
              </label>
              <textarea
                id="liText"
                placeholder={
                  'Results-driven software engineer passionate about leveraging synergistic paradigms to deliver mission-critical solutions...'
                }
                value={liText}
                onChange={(e) => setLiText(e.target.value)}
                maxLength={6000}
              />
              <p className="hint">
                Paste your headline, About section, or any LinkedIn copy. Claude will eviscerate
                every buzzword, humble-brag, and vague skill claim.
              </p>
              <SavageToggle tab="linkedin" checked={savage.linkedin} onChange={setSavage} />
              <p className="usage-note">
                {remainingToday > 0
                  ? `${remainingToday} of ${DAILY_DISPLAY_CAP} free roasts left today`
                  : "You've used today's free roasts — come back tomorrow"}
              </p>
              <button className="fire-btn" onClick={roast} disabled={loading}>
                {'\u{1F525}'} {loading ? 'Roasting...' : 'Roast my LinkedIn'}
              </button>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="pane">
              <label className="lbl" htmlFor="cvText">
                Paste your resume as plain text
              </label>
              <textarea
                id="cvText"
                placeholder={
                  'Jane Smith\nSoftware Engineer\n\nSKILLS: Python (6 months), Fast learner, Good communicator, Microsoft Word, Team player\n\nEXPERIENCE\nDigital Innovation Specialist (6 months)\nLeveraged cutting-edge solutions to deliver impactful synergies...'
                }
                value={cvText}
                onChange={(e) => setCvText(e.target.value)}
                maxLength={6000}
              />
              <p className="hint">
                Paste your full resume. Claude will roast your 3-page CV for 6 months of
                experience, your &quot;proficient in Microsoft Word&quot;, and everything else.
              </p>
              <SavageToggle tab="resume" checked={savage.resume} onChange={setSavage} />
              <p className="usage-note">
                {remainingToday > 0
                  ? `${remainingToday} of ${DAILY_DISPLAY_CAP} free roasts left today`
                  : "You've used today's free roasts — come back tomorrow"}
              </p>
              <button className="fire-btn" onClick={roast} disabled={loading}>
                {'\u{1F525}'} {loading ? 'Roasting...' : 'Roast my resume'}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="err-bar" role="alert">
            {'\u26A0'} {errorMsg}
          </div>
        )}

        {loading && (
          <div className="terminal" aria-live="polite" aria-label="Loading status">
            <div className="t-header">
              <span className="t-dot t-dot-r" />
              <span className="t-dot t-dot-y" />
              <span className="t-dot t-dot-g" />
              &nbsp;ROAST ENGINE — RUNNING
            </div>
            {LOADING_LINES[activeTab].map((line, i) => (
              <div className="t-line" style={{ animationDelay: `${i * 0.38}s` }} key={line}>
                {line}
              </div>
            ))}
            <span className="t-cursor" aria-hidden="true" />
          </div>
        )}

        {result && (
          <section className="result" ref={resultRef} aria-label="Roast result">
            <div className="result-hdr">
              <span className="result-hdr-title">{'\u26A1'} Damage report</span>
              <span className="result-target">{result.label}</span>
            </div>
            <div className="result-body">
              <div className="score-wrap">
                <p className="score-lbl">Developer damage score</p>
                <div className="score-row">
                  <div className="score-num">{result.score}</div>
                  <div className="score-info">
                    <div className="score-verdict">{result.verdict}</div>
                    <div className="score-out-of">out of 100 — lower = more damage</div>
                  </div>
                </div>
                <div
                  className="bar-bg"
                  role="progressbar"
                  aria-valuenow={100 - result.score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Damage level"
                >
                  <div className="bar-fill" ref={barFillRef} />
                  <div className="bar-ticks" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={i} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="roast-txt" aria-label="The roast">
                {result.roast}
              </div>

              <div className="act-row">
                <button className="act-btn yellow" onClick={() => setShowCard(true)}>
                  {'\u{1F4F8}'} Generate card
                </button>
                <button className="act-btn cyan" onClick={tweetIt}>
                  {'\u{1F426}'} Share on X
                </button>
                <button className="act-btn" onClick={copyText}>
                  {'\u{1F4CB}'} {copyLabel}
                </button>
                <button className="act-btn" onClick={resetAll}>
                  {'\u{1F504}'} Roast again
                </button>
              </div>

              {showCard && (
                <div className="card-section">
                  <p className="card-section-lbl" style={{ marginTop: '1.5rem' }}>
                    Shareable roast card
                  </p>

                  <div id="roastCard" ref={cardRef}>
                    <div className="card-body">
                      <div className="card-toprow">
                        <span className="card-site">roastmyprofile.dev</span>
                        <span className="card-type">{typeLabels[activeTab]}</span>
                      </div>
                      <div className="card-user">{result.label}</div>
                      <div className="card-score-row">
                        <span className="card-score-big">{result.score}</span>
                        <span className="card-score-denom">/100 damage</span>
                      </div>
                      <div className="card-verdict">{result.verdict}</div>
                      <div className="card-quote">&quot;{excerpt}&quot;</div>
                      <div className="card-stats">
                        {result.stats_roasted.slice(0, 3).map((s, i) => (
                          <div key={i}>
                            <span className="card-stat-val">{s.value}</span>
                            <span className="card-stat-lbl">{s.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="card-footer">
                        <span className="card-url">roastmyprofile.dev</span>
                        <span className="card-wm">Get roasted {'\u2192'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="dl-btn-wrap">
                    <button className="dl-btn" onClick={downloadCard} disabled={dlBusy}>
                      {'\u2B07'} {dlLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="how" aria-label="How it works">
          <p className="how-eyebrow">Under the hood</p>
          <h2 className="how-title">How it works</h2>
          <div className="steps">
            <div className="step">
              <span className="step-num">01</span>
              <p className="step-t">Feed your data</p>
              <p className="step-d">
                Enter a GitHub username (real API fetch) or paste LinkedIn or resume text. The
                more real the data, the more specific the pain.
              </p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <p className="step-t">Claude destroys you</p>
              <p className="step-d">
                Claude gets a comedy-writer persona and your structured data. It generates a
                damage score, a verdict title, and a 200-word roast.
              </p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <p className="step-t">Share the damage</p>
              <p className="step-d">
                Download a brutal roast card as a PNG. Post it, tag friends, start a roast thread.
                One post can bring dozens of new victims.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="ftr">
        <p className="ftr-txt">
          <b>ROAST MY PROFILE</b> {'\u00B7'} Powered by <span>Claude AI</span> {'\u00B7'} Built for
          developers who can take a joke
          <br />
          <span style={{ color: 'rgba(255,255,255,.18)', fontSize: '.65rem' }}>
            Free roasts are limited per visitor each day to keep this running for everyone.
          </span>
        </p>
      </footer>
    </>
  );
}

function SavageToggle({
  tab,
  checked,
  onChange,
}: {
  tab: TabId;
  checked: boolean;
  onChange: (updater: (prev: Record<TabId, boolean>) => Record<TabId, boolean>) => void;
}) {
  const id = `savage-${tab}`;
  return (
    <label className="savage-wrap" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => {
          const next = e.target.checked;
          onChange((prev) => ({ ...prev, [tab]: next }));
        }}
      />
      <span className="savage-lbl">{'\u{1F480}'} Ultra savage mode</span>
      <span className="savage-badge">Experimental</span>
      <span className="savage-note">Zero filter, no mercy</span>
    </label>
  );
}
