export const OPERATIONAL_POSITIONS = ["Diretor", "Executivo de Negócios", "SDR"] as const;

export type OperationalPosition = typeof OPERATIONAL_POSITIONS[number];

export function isOperationalPosition(position?: string | null): position is OperationalPosition {
  return OPERATIONAL_POSITIONS.includes(position as OperationalPosition);
}

export function isPureSystemAdmin(role?: string | null, position?: string | null) {
  return role === "admin" && !isOperationalPosition(position);
}
