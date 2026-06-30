export type RoastType = 'github' | 'linkedin' | 'resume';

export interface StatRoasted {
  label: string;
  value: string;
}

export interface RoastRequestBody {
  type: RoastType;
  input: string;
  savage?: boolean;
}

export interface RoastResponse {
  score: number;
  verdict: string;
  roast: string;
  lines: string[];
  stats_roasted: StatRoasted[];
  label: string;
  type: RoastType;
}

export interface ApiErrorBody {
  error: string;
}
