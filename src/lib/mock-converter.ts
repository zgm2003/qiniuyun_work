import { parseNovelChapters, requireMinimumChapters, type NovelChapter } from "./chapters";
import { stringifyScriptDocument, validateScriptYaml, type ScriptDocument } from "./script-schema";

export type NovelConversionInput = {
  title: string;
  text: string;
};

export type ConversionReport = {
  provider: "mock";
  chapterCount: number;
  characterCount: number;
  sceneCount: number;
  dialogueLineCount: number;
  validationPassed: boolean;
};

export type NovelConversionResult = {
  yaml: string;
  report: ConversionReport;
};

const NAME_BEFORE_VERB = /(?:^|[。！？!?\n])\s*([\u4e00-\u9fa5]{2,3})(?=在|带着|收到|来到|出现|提醒|承认|追查|对峙|说|问|答)/g;
const NAME_AFTER_WITH = /(?:和|与)([\u4e00-\u9fa5]{2,4})(?=在|对峙|交谈|争论|见面)/g;
const NON_CHARACTER_WORDS = new Set(["信里", "真相", "火灾", "天台", "地铁"]);

function collectMatches(pattern: RegExp, text: string): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[1]);
}

function extractCharacterNames(text: string): string[] {
  const names = [...collectMatches(NAME_BEFORE_VERB, text), ...collectMatches(NAME_AFTER_WITH, text)];
  const unique = Array.from(new Set(names.filter((name) => !NON_CHARACTER_WORDS.has(name))));

  if (unique.length > 0) {
    return unique.slice(0, 6);
  }

  return ["叙述者"];
}

function firstSentence(body: string): string {
  const sentence = body.split(/[。！？!?]/).find((part) => part.trim().length > 0);
  if (!sentence) {
    throw new Error("章节正文不能为空");
  }

  return `${sentence.trim()}。`;
}

function buildSceneDialogue(chapter: NovelChapter, characterId: string, chapterPosition: number) {
  const prompts = [
    "这件事不能再被当作普通意外了。",
    "如果继续追查，我们就得面对真正的问题。",
    "现在该把隐藏的真相说出来了。"
  ];

  return [
    {
      character: characterId,
      line: prompts[chapterPosition] ?? `关于“${chapter.title}”，我必须做出选择。`,
      emotion: chapterPosition === 0 ? "疑惑" : chapterPosition === 1 ? "警惕" : "坚定"
    }
  ];
}

function buildScriptDocument(input: NovelConversionInput): ScriptDocument {
  const chapters = parseNovelChapters(input.text);
  requireMinimumChapters(chapters, 3);

  const characterNames = extractCharacterNames(input.text);
  const characters = characterNames.map((name, index) => ({
    id: `char_${String(index + 1).padStart(3, "0")}`,
    name,
    role: index === 0 ? ("protagonist" as const) : ("supporting" as const),
    traits: index === 0 ? ["主动", "执着"] : ["保守", "知情"]
  }));

  const primaryCharacterId = characters[0].id;

  return {
    metadata: {
      title: input.title.trim(),
      source_chapters: chapters.length,
      language: "zh-CN",
      format_version: "1.0"
    },
    characters,
    scenes: chapters.map((chapter, index) => ({
      id: `scene_${String(index + 1).padStart(3, "0")}`,
      chapter: chapter.index,
      heading: chapter.title,
      location: index === 0 ? "旧书店" : index === 1 ? "末班地铁" : "城市天台",
      time: index === 0 ? "雨夜" : index === 1 ? "深夜" : "黎明前",
      characters: characters.slice(0, Math.min(characters.length, index + 1)).map((character) => character.id),
      action: firstSentence(chapter.body),
      dialogue: buildSceneDialogue(chapter, primaryCharacterId, index),
      camera_notes: index === 0 ? "近景捕捉主角看到线索时的停顿。" : index === 1 ? "车厢灯光闪烁，制造压迫感。" : "镜头从两人推向远处城市天际线。"
    })),
    summary: {
      logline: `${input.title.trim()}讲述主角追查线索并面对真相的故事。`,
      themes: ["真相", "选择", "信任"],
      adaptation_notes: [
        "按章节建立场景，保留原小说的主要悬念推进。",
        "减少解释性旁白，把关键信息转为动作和台词。"
      ]
    }
  };
}

export function convertNovelToScript(input: NovelConversionInput): NovelConversionResult {
  const title = input.title.trim();
  if (!title) {
    throw new Error("标题不能为空");
  }

  const document = buildScriptDocument({ title, text: input.text });
  const yaml = stringifyScriptDocument(document);
  const validation = validateScriptYaml(yaml);

  return {
    yaml,
    report: {
      provider: "mock",
      chapterCount: document.metadata.source_chapters,
      characterCount: document.characters.length,
      sceneCount: document.scenes.length,
      dialogueLineCount: document.scenes.reduce((count, scene) => count + scene.dialogue.length, 0),
      validationPassed: validation.ok
    }
  };
}

