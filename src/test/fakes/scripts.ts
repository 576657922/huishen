/**
 * 测试用的引导词。和正式内容分开，内容修改不会让引擎测试失效。
 * 前三份是写法正常的脚本，EDGE_CASE_SCRIPT 专门放各种边角情况，LAYERED_SCRIPT 用来测引导详细程度。
 */
import type { GuidedScript } from '@/content/types'

/** 三分钟呼吸空间：段落少、时长短，最短时长下也要说得完 */
export const BREATHING_SPACE_SCRIPT: GuidedScript = {
  id: 'breathing-space',
  title: '三分钟呼吸空间',
  minMinutes: 3,
  maxMinutes: 6,
  opening: [{ text: '坐直一些，让身体稳定、放松。' }, { text: '如果愿意，可以轻轻闭上眼睛。' }],
  sections: [
    {
      id: 'aware',
      title: '觉察',
      weight: 1,
      minSilence: 15,
      intro: [
        { text: '此刻，心里有什么？留意出现的想法，只是看见，不评判。' },
        { text: '再留意身体的感觉，紧绷也好，不适也好，承认它们在这里。' },
      ],
      reminders: ['想法、情绪、身体的感觉，看见它们就好。'],
    },
    {
      id: 'gather',
      title: '聚焦呼吸',
      weight: 1.2,
      minSilence: 20,
      intro: [{ text: '把注意力收拢到呼吸上，' }, { text: '感受腹部随吸气鼓起，随呼气回落。' }],
      reminders: ['走神了，就轻轻回到呼吸。'],
    },
    {
      id: 'expand',
      title: '扩展',
      weight: 1,
      minSilence: 15,
      intro: [
        { text: '让觉察从呼吸扩展到整个身体，' },
        { text: '连同姿势和面部的表情，感受身体作为一个整体在呼吸。' },
      ],
      reminders: ['整个身体都在呼吸。'],
    },
  ],
  closing: [{ text: '准备好时，把这份觉察带进接下来的时间。' }],
}

/** 身体扫描：段落多，部分段落只在较长时长下出现；各个部位可以「跳过这一处」，最后的全身不能 */
export const BODY_SCAN_SCRIPT: GuidedScript = {
  id: 'body-scan',
  title: '身体扫描',
  minMinutes: 8,
  maxMinutes: 45,
  opening: [
    { text: '找一个可以躺下或靠坐的地方，让身体被完全承托。' },
    { text: '这段练习不是为了放松，也不是为了达到什么，只是感受身体此刻的样子。' },
    { text: '先觉察几次呼吸。', pause: 4 },
  ],
  sections: [
    {
      id: 'feet',
      skippable: true,
      title: '双脚',
      weight: 1,
      minSilence: 20,
      intro: [
        { text: '把注意力带到双脚。' },
        { text: '脚趾、脚掌、脚跟，留意任何感觉：温度、压力、刺痛，或者什么也没有。' },
      ],
      reminders: ['注意力跑开了，就回到双脚。', '没有感觉，也是一种感觉。'],
    },
    {
      id: 'legs',
      skippable: true,
      title: '小腿和膝盖',
      weight: 1,
      minSilence: 20,
      intro: [{ text: '让注意力离开双脚，来到小腿和膝盖。' }],
      reminders: ['留意小腿和膝盖此刻的感觉。'],
    },
    {
      id: 'thighs',
      skippable: true,
      title: '大腿和臀部',
      weight: 1,
      minSilence: 20,
      omitAtOrBelow: 10,
      intro: [{ text: '来到大腿和臀部，感受身体与地面或椅子接触的地方。' }],
      reminders: ['重量被承托着，不需要用力。'],
    },
    {
      id: 'belly',
      skippable: true,
      title: '腹部和腰背',
      weight: 1.2,
      minSilence: 25,
      intro: [{ text: '来到腹部，感受它随呼吸起伏。' }, { text: '再到腰背，留意那里的紧或松。' }],
      reminders: ['跟着呼吸，感受腹部的起伏。'],
    },
    {
      id: 'chest',
      skippable: true,
      title: '胸口和上背',
      weight: 1,
      minSilence: 20,
      intro: [{ text: '来到胸口和上背，感受呼吸带来的扩展与回落。' }],
      reminders: ['如果有情绪出现，允许它在这里。'],
    },
    {
      id: 'arms',
      skippable: true,
      title: '双手和手臂',
      weight: 1,
      minSilence: 20,
      omitAtOrBelow: 12,
      intro: [{ text: '来到双手，指尖、手掌、手背，然后是手臂。' }],
      reminders: ['留意双手此刻的感觉。'],
    },
    {
      id: 'neck',
      skippable: true,
      title: '肩颈',
      weight: 1,
      minSilence: 20,
      intro: [{ text: '来到肩膀和脖子，这里常常积着紧张。' }, { text: '不用刻意放松，只是觉察。' }],
      reminders: ['觉察肩颈，不急着改变什么。'],
    },
    {
      id: 'head',
      skippable: true,
      title: '头面部',
      weight: 1,
      minSilence: 20,
      intro: [{ text: '来到脸部：下巴、嘴唇、眼睛周围、额头，最后是整个头部。' }],
      reminders: ['留意脸上细微的感觉。'],
    },
    {
      id: 'whole',
      title: '全身',
      weight: 1.5,
      minSilence: 30,
      intro: [{ text: '现在，把整个身体放进觉察里，从头到脚，作为一个整体。' }],
      reminders: ['整个身体，此刻就在这里。', '走神了，就回到整个身体的感觉。'],
    },
  ],
  closing: [{ text: '慢慢加深呼吸，动一动手指和脚趾。' }, { text: '准备好时，睁开眼睛。' }],
}

/** 慈心：提醒是反复默念的祝愿短句；难相处的人那一段可以跳过 */
export const LOVING_KINDNESS_SCRIPT: GuidedScript = {
  id: 'loving-kindness',
  title: '慈心',
  minMinutes: 5,
  maxMinutes: 30,
  opening: [
    { text: '舒服地坐好，把手放在胸口或腹部，感受手掌的温度。' },
    { text: '接下来，我们在心里默念几句祝愿，先给自己，再慢慢扩展出去。' },
  ],
  sections: [
    {
      id: 'self',
      title: '自己',
      weight: 1.2,
      minSilence: 30,
      intro: [
        { text: '想着自己，在心里默念：' },
        { text: '愿我平安，愿我健康，愿我快乐，愿我自在。', pause: 3 },
      ],
      reminders: ['愿我平安。愿我健康。', '愿我快乐。愿我自在。'],
    },
    {
      id: 'dear',
      title: '亲近的人',
      weight: 1,
      minSilence: 25,
      intro: [
        { text: '想起一位你很容易就能祝福的人，看见他的样子。' },
        { text: '愿你平安，愿你健康，愿你快乐，愿你自在。', pause: 3 },
      ],
      reminders: ['愿你平安。愿你健康。', '愿你快乐。愿你自在。'],
    },
    {
      id: 'neutral',
      title: '不熟悉的人',
      weight: 1,
      minSilence: 25,
      omitAtOrBelow: 6,
      intro: [
        { text: '想起一位你认识、但没有特别感受的人，比如常去那家店的店员。' },
        { text: '他也和你一样，希望平安、快乐。' },
      ],
      reminders: ['愿你平安。愿你快乐。'],
    },
    {
      id: 'difficult',
      skippable: true,
      title: '难相处的人',
      weight: 1,
      minSilence: 25,
      omitAtOrBelow: 10,
      intro: [
        { text: '如果愿意，想起一位让你有些为难的人，不必选最难的那位。' },
        { text: '如果感到抗拒，就回到对自己的祝愿。' },
      ],
      reminders: ['愿你平安。', '照顾好自己的感受，随时可以回到自己。'],
    },
    {
      id: 'all',
      title: '所有人',
      weight: 1.2,
      minSilence: 30,
      intro: [
        { text: '最后，让祝愿向四面八方扩展，给所有的人、所有的生命。' },
        { text: '愿大家平安，愿大家健康，愿大家快乐，愿大家自在。', pause: 3 },
      ],
      reminders: ['愿大家平安，愿大家自在。'],
    },
  ],
  closing: [{ text: '让这份善意留在身体里。' }, { text: '慢慢睁开眼睛。' }],
}

/**
 * 边角情况：空行当停顿、引号收尾、英文标点、无标点、显式停顿为 0、
 * 权重为 0 的段、没有引导语的段、只有标点的提醒、只在长时长出现的段、只有标点的结尾行
 */
export const EDGE_CASE_SCRIPT: GuidedScript = {
  id: 'open-awareness',
  title: '开放觉察',
  minMinutes: 3,
  maxMinutes: 45,
  opening: [
    { text: '', pause: 2 },
    { text: '「先安静地坐一会儿。」' },
    { text: 'Breathe in.' },
    { text: '不加标点的一句' },
  ],
  sections: [
    {
      id: 'zero-weight',
      title: '零权重',
      weight: 0,
      intro: [{ text: '这一段不分静默。' }],
    },
    {
      id: 'no-intro',
      title: '没有引导语',
      weight: 1,
      intro: [],
      reminders: ['静静地坐着。'],
    },
    {
      id: 'main',
      title: '开放',
      weight: 3,
      minSilence: 40,
      intro: [{ text: '让觉察打开，', pause: 0 }, { text: '声音、身体、念头，来了就来，去了就去。' }],
      reminders: ['不追随，也不推开。', '只是知道。', '……'],
    },
    {
      id: 'long-only',
      title: '长时长才有',
      weight: 1,
      minSilence: 10,
      omitAtOrBelow: 20,
      intro: [{ text: '只在长时间的练习里出现的段落。' }],
    },
  ],
  closing: [{ text: '回到呼吸，回到身体。' }, { text: '……' }],
}

/**
 * 分档的引导词：三个档位各有句子，有只在长时长才说的句子，也有朗读用字（say）和字幕不同的句子。
 * 不填档位时每一句都说；最短时长、最慢语速下也说得完
 */
export const LAYERED_SCRIPT: GuidedScript = {
  id: 'focus',
  title: '专注呼吸',
  minMinutes: 3,
  maxMinutes: 30,
  opening: [
    { text: '这是专注呼吸练习。' },
    { text: '如果感到不适，随时可以停下来。' },
    { text: '坐得舒服一些，背自然挺直。', detail: 'standard' },
    { text: '可以闭上眼睛，也可以让目光落在前方。', detail: 'detailed' },
    { text: '时间还长，不用急着进入状态。', detail: 'standard', minMinutes: 10 },
  ],
  sections: [
    {
      id: 'anchor',
      title: '找到呼吸',
      weight: 1,
      minSilence: 20,
      intro: [
        { text: '留意呼吸在哪里最清楚：鼻尖、胸口，或者腹部。' },
        { text: '选一处，让注意力停在那里。', detail: 'standard' },
        { text: '不需要改变呼吸，只是知道它。', detail: 'detailed' },
      ],
      reminders: ['回到呼吸。'],
    },
    {
      id: 'wander',
      title: '走神与回来',
      weight: 2,
      minSilence: 30,
      intro: [
        { text: '发现走神，本身就是练习。' },
        { text: '轻点「回神」，再回到呼吸。', say: '轻轻点一下屏幕，再回到呼吸。' },
        { text: '每一次回来，都是一次练习。', detail: 'detailed', minMinutes: 10 },
      ],
      reminders: ['走神了，就回来。', '呼吸一直都在。'],
    },
  ],
  closing: [{ text: '让注意力放开呼吸。', detail: 'standard' }, { text: '准备好时，睁开眼睛。' }],
}

export const FIXTURE_SCRIPTS: readonly GuidedScript[] = [
  BREATHING_SPACE_SCRIPT,
  BODY_SCAN_SCRIPT,
  LOVING_KINDNESS_SCRIPT,
  EDGE_CASE_SCRIPT,
  LAYERED_SCRIPT,
]
