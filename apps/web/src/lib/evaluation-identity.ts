// Cookie rotation invalidates old in-flight profile requests before the portal reloads.
let generation = 0;
let switching = false;
export const evaluationIdentityGeneration = () => generation;
export function beginEvaluationIdentityChange() {
  generation += 1;
  switching = true;
}
export function cancelEvaluationIdentityChange() {
  switching = false;
}
export function evaluationIdentityIsCurrent(
  requestGeneration: number,
  token: string | null,
) {
  return (
    token !== "__evaluation__" ||
    (!switching && requestGeneration === generation)
  );
}
