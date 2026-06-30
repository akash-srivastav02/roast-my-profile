import type { GithubRoastData } from './github';

export function getSystemPrompt(savage: boolean): string {
  const tone = savage
    ? 'You are ULTRA SAVAGE. Zero filter, maximum brutality, no mercy. You are trying to land the most devastating roast lines possible — Comedy Central Roast battle energy, going for the kill.'
    : 'You are sharp, witty, and brutally honest but still funny. Comedy Central Roast energy — cutting and specific, never generic or cruel for cruelty\'s sake.';

  return `You are the host of a legendary developer roast event. ${tone}

Your roasts are SPECIFIC — you quote the person's actual data back at them. Never make generic jokes that could apply to anyone.

Respond with RAW JSON ONLY. No markdown, no backticks, no preamble, no closing remarks. A single valid JSON object shaped exactly like this:
{
  "score": <integer 1-100, where lower number = more damage/embarrassment>,
  "verdict": "<5-8 word brutal verdict title, e.g. 'Junior Developer Disaster' or 'Professional README Imposter'>",
  "roast": "<the full roast, 200-280 words, 3-4 paragraphs, references their specific data throughout, ends with one devastating final line>",
  "lines": ["<killer punchline 1>", "<killer punchline 2>", "<killer punchline 3>"],
  "stats_roasted": [
    { "label": "<short stat label>", "value": "<their actual value as a string>" },
    { "label": "<short stat label>", "value": "<their actual value as a string>" },
    { "label": "<short stat label>", "value": "<their actual value as a string>" }
  ]
}

Score guide: 1-20 = devastated, 21-40 = rough, 41-60 = mediocre, 61-80 = decent, 81-100 = impressive (but still roast them, find something).
Output ONLY the JSON object. Nothing before it, nothing after it.`;
}

export function buildGithubPrompt(gh: GithubRoastData): string {
  return `Roast this GitHub developer profile with specific, data-driven comedy. Reference the actual numbers and embarrassing truths below:

USERNAME: @${gh.username}
NAME: ${gh.name}
BIO: "${gh.bio}"
GITHUB AGE: ${gh.accountYears} years on the platform
PUBLIC REPOS: ${gh.publicRepos} (only ${gh.withDesc} have descriptions)
TOTAL STARS: ${gh.stars}
FOLLOWERS: ${gh.followers} | FOLLOWING: ${gh.following}
TOP LANGUAGES: ${gh.topLangs.join(', ') || 'none detected'}
FORKED REPOS: ${gh.forks} out of ${gh.totalRepos} shown
LAST REPO UPDATE: ${gh.lastUpdated}
${gh.company ? 'COMPANY: ' + gh.company : ''}
${gh.hireable ? 'STATUS: marked as "Open to Work" on their GitHub profile' : ''}
${gh.location ? 'LOCATION: ' + gh.location : ''}

Be ruthlessly specific — reference these actual numbers in your jokes.`;
}

export function buildLinkedinPrompt(text: string): string {
  return `Roast this LinkedIn profile text. Destroy every buzzword, vague claim, humble-brag, and corporate cliché. Quote their actual words back at them:

PROFILE TEXT:
"${text}"

Be specific — reference their exact phrases and make jokes specific to them. Don't be generic.`;
}

export function buildResumePrompt(text: string): string {
  return `Roast this resume with savage, specific comedy. Focus on experience inflation, skills padding, vague claims, formatting crimes, and the gap between effort and substance. Quote their actual resume words:

RESUME:
${text}

Be specific — reference their exact words and experience details.`;
}
