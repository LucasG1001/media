export interface CompletionRule {
  whenStatus: string;
  rewatchStatus?: string;
}

// Insert: só entrar já concluído grava. Entrar já em revisita não conta — o app
// nunca viu a primeira conclusão.
export function completedOnInsertSql(statusExpr: string, whenStatus: string): string {
  return `CASE WHEN ${statusExpr} = '${whenStatus}' THEN NOW() ELSE NULL END`;
}

// Data da primeira conclusão. A revisita é parte do ciclo de concluído: entrar ou
// sair dela mantém a data, senão rever algo apagaria quando foi concluído.
// `statusColumn` sem prefixo lê o valor pré-UPDATE da linha.
export function completionUpdateSql(
  column: string,
  newStatusExpr: string,
  statusColumn: string,
  rule: CompletionRule
): string {
  const done = `'${rule.whenStatus}'`;
  if (!rule.rewatchStatus) {
    return `CASE
             WHEN ${newStatusExpr} = ${done} AND ${statusColumn} != ${done} THEN NOW()
             WHEN ${newStatusExpr} != ${done} THEN NULL
             ELSE ${column}
           END`;
  }
  const again = `'${rule.rewatchStatus}'`;
  return `CASE
             WHEN ${newStatusExpr} = ${done} AND ${statusColumn} = ${again} THEN COALESCE(${column}, NOW())
             WHEN ${newStatusExpr} = ${done} AND ${statusColumn} != ${done} THEN NOW()
             WHEN ${newStatusExpr} IN (${done}, ${again}) THEN ${column}
             ELSE NULL
           END`;
}

// Último acesso: só a transição para o concluído grava (inclusive vindo da revisita,
// que é como se registra ter consumido de novo), e nunca é limpo.
export function lastAccessUpdateSql(
  column: string,
  newStatusExpr: string,
  statusColumn: string,
  rule: CompletionRule
): string {
  const done = `'${rule.whenStatus}'`;
  return `CASE
           WHEN ${newStatusExpr} = ${done} AND ${statusColumn} != ${done} THEN NOW()
           ELSE ${column}
         END`;
}
