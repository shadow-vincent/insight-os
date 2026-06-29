// packages/llm/src/kernel-injector.ts
var CATEGORY_LABEL = {
  belief: { zh: "\u5E95\u5C42\u4FE1\u5FF5", en: "Belief", emoji: "\u25C6" },
  contrarian: { zh: "\u53CD\u5E38\u8BC6\u5224\u65AD", en: "Contrarian", emoji: "\u25C7" },
  expertise: { zh: "\u64C5\u957F\u95EE\u9898\u57DF", en: "Expertise", emoji: "\u25C8" },
  challenge: { zh: "\u60F3\u6311\u6218\u7684\u5E38\u8BC6", en: "Challenge", emoji: "\u25C9" }
};
function renderEntry(entry) {
  const conf = Math.max(0, Math.min(100, entry.confidence));
  let line = `- ${entry.content}\uFF08\u7F6E\u4FE1\u5EA6 ${conf}/100\uFF09`;
  if (entry.scope?.trim()) {
    line += `  \xB7 \u9002\u7528: ${entry.scope}`;
  }
  if (entry.counterExample?.trim()) {
    line += `
  - \u4E0D\u9002\u7528\u573A\u666F: ${entry.counterExample}`;
  }
  return line;
}
function kernelToSystemPrompt(kernels) {
  if (!kernels || kernels.length === 0) return "";
  const groups = {
    belief: [],
    contrarian: [],
    expertise: [],
    challenge: []
  };
  for (const k of kernels) {
    if (!k.content?.trim()) continue;
    if (!groups[k.category]) continue;
    groups[k.category].push(k);
  }
  const sections = [];
  const order = ["belief", "contrarian", "expertise", "challenge"];
  for (const cat of order) {
    const list = groups[cat];
    if (list.length === 0) continue;
    const label = CATEGORY_LABEL[cat];
    sections.push(`## ${label.zh} (${label.en})
${list.map(renderEntry).join("\n")}`);
  }
  if (sections.length === 0) return "";
  return [
    "# Insight Kernel\uFF08\u7528\u6237\u5224\u65AD\u534F\u8BAE\uFF09",
    "\u4F60\u5728\u6240\u6709\u5199\u4F5C\u3001\u5BF9\u8BDD\u3001\u6539\u7A3F\u3001\u63A8\u6F14\u65F6\u5E94\u9075\u5FAA\u4EE5\u4E0B\u7ACB\u573A\u3002",
    "\u8FD9\u4E9B\u662F\u7ECF\u8FC7\u7528\u6237\u786E\u8BA4\u7684\u5224\u65AD\uFF0C\u4E0D\u662F\u901A\u7528 LLM \u8C03\u8C03\u2014\u2014\u8BF7\u4E25\u683C\u9075\u5B88\u3002",
    "",
    ...sections,
    "",
    "---",
    ""
  ].join("\n");
}
function prependKernel(sysPrompt, kernel) {
  if (!kernel || kernel.length === 0) return sysPrompt;
  const prefix = kernelToSystemPrompt(kernel);
  if (!prefix) return sysPrompt;
  return `${prefix}
${sysPrompt}`;
}
export {
  kernelToSystemPrompt,
  prependKernel
};
