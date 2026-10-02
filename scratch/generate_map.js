import fs from 'fs';
import { KAP_THEMES, KAP_QUESTIONNAIRE } from '../frontend/src/utils/kapQuestionnaire.js';

const code = `export const KAP_THEMES = ${JSON.stringify(KAP_THEMES, null, 2)};

export const KAP_QUESTIONNAIRE = ${JSON.stringify(KAP_QUESTIONNAIRE, null, 2)};

export function getQuestionDomain(code = "") {
  if (code.includes("[K]")) return "Knowledge";
  if (code.includes("[A]")) return "Attitude";
  if (code.includes("[P]")) return "Practice";
  return "Knowledge";
}

export function isResponsePositive(val) {
  if (val === "Yes" || val === "Agree" || val === "Satisfied") return true;
  if (Array.isArray(val)) {
    return val.length > 0 && !val.includes("Don't know");
  }
  return false;
}

const ALL_QUESTIONS_MAP = {};
for (const [cat, qs] of Object.entries(KAP_QUESTIONNAIRE)) {
  for (const q of qs) {
    ALL_QUESTIONS_MAP[q.id] = {
      ...q,
      domain: getQuestionDomain(q.code),
      category: cat,
    };
  }
}

export function findQuestionById(qId) {
  return ALL_QUESTIONS_MAP[qId] || null;
}

export function buildDetailedResponses(responses, respondentCategory) {
  if (!responses || typeof responses !== "object") return [];
  const detailed = [];
  for (const [qId, val] of Object.entries(responses)) {
    if (val === undefined || val === null) continue;
    const qInfo = findQuestionById(qId);
    const domain = qInfo ? getQuestionDomain(qInfo.code) : (qId.startsWith("AT") || qId.includes("T") ? "Attitude" : qId.includes("P") ? "Practice" : "Knowledge");
    const themeId = qInfo?.themeId || 1;
    const themeObj = KAP_THEMES.find((t) => t.id === themeId) || KAP_THEMES[0];
    const isPos = isResponsePositive(val);
    detailed.push({
      questionId: qId,
      code: qInfo?.code || \`\${qId} [\${domain[0]}]\`,
      domain,
      themeId,
      themeTitle: themeObj.titleEn,
      response: val,
      isPositive: isPos,
    });
  }
  return detailed;
}
`;

fs.writeFileSync('./backend/src/utils/kapQuestionnaireMap.js', code);
console.log('Successfully generated kapQuestionnaireMap.js');
