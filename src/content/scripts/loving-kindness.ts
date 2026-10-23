/**
 * 慈心（5 / 10 / 20 分钟）。原创中文引导词，只沿用公开的练习结构，不翻译、不改写任何现成录音。
 *
 * 结构依据：
 * - meditation-zeng-2015：先讲解再练习（没有讲解环节的干预效应较小）。
 * - meditation-galante-2014：起初可能生硬、难过，开头就说明，并给出更容易的对象：
 *   第一个人选关系简单的，想到会难过就换一位。
 * - practice-fredrickson-2008：注意力先放在心口，从本来就让你感到温暖的人开始，再到自己，圈子逐步扩大。
 * - practice-uclamarc-2016：宠物也可以；先接受对方回送的祝愿，再给自己；没有感觉也没关系。
 * - practice-santorelli-2017：少说话、留出空间、以静默结束；祝愿语可用可不用；承认抗拒；
 *   随时可以换姿势、睁眼或停下。
 * - practice-schroter-2022：难相处的人只放在 20 分钟版的后段，只选轻微的，可以跳过；
 *   闭着眼也能跳过（继续祝愿亲近的人），停留不长，结束时回到亲近的人，再扩展到所有生命。
 * - meditation-lindsay-2018：每次都教接纳；meditation-hasenkamp-2012：走神 → 发现 → 轻轻放下 → 回来。
 * - practice-baer-2019、practice-deroche-2025：邀请的语气；留意胸口不舒服时改用双脚，任何档位都说；
 *   情绪太强时感受双脚、听声音或睁眼看看四周。
 * 安全提示改写自 safety.notes §5「慈心 / 自我关怀」，措辞与自我关怀练习一致，开头十秒内任何档位都说。
 * 证据等级 B（积极情绪），引导词里不提任何效果。
 *
 * 时间结构（practice.notes §2.5）：5 分钟只有亲近的人、自己、所有生命；10 分钟加朋友和不太熟的人；
 * 20 分钟再加有点难相处的人，最长的静默留在结尾的安静片刻。每句祝愿后留 4.5 秒安静，供在心里跟着默念；
 * 「详细」档在 20 分钟版里把三轮主要的祝愿再放慢说一遍，每句后留 6 秒。
 * 人声占比目标（标准档；人声 = 朗读加句末的自然停顿，祝愿后多出的安静算静默）：
 * 5 分钟约 70%，10 分钟约 60%，20 分钟约 45%（设计值，未经试验检验）。
 * 5 分钟详细档只比标准档多两句：祝愿后的安静和各段静默下限已占满时长，
 * 再加就要压缩祝愿后的安静，所以达不到「比标准高 10–15 个百分点」。
 * 已知局限：提醒只在 75 秒以上的静默里插入，不分档位，所以 20 分钟详细档各段仍有半分钟到一分钟的静默、
 * 没有提醒；需要引擎按档位插入提醒，引导词里不靠堆句子去填。
 * v1 是文字引导（PRODUCT.md §0、§5）：祝愿一句一句出现在屏幕上，读到一句，在心里跟着念。「安顿」里说一次怎么看：
 * 目光落在屏幕上；10 分钟起各段末尾有二十秒以上的安静，才加上可以闭眼、听到轻响再看屏幕（5 分钟的标准档、
 * 详细档没有这么长的安静）。「也可以只是听」改为「也可以只是看着」，犯困时「睁着眼睛练」，结尾改为「抬起目光」。
 */
import type { GuidedScript, ScriptLine } from '@/content/types'

/** 每句祝愿之后的安静（秒），够在心里慢慢跟着念一遍 */
const WISH_PAUSE = 4.5
/** 放慢的第二轮，每句之后的安静（秒） */
const SLOW_WISH_PAUSE = 6

/** 四句祝愿：平安、健康、内心安宁、自在。整轮只在某个档位或时长才说时，用 only 标出 */
const wishes = (who: '你' | '我' | '他们', only: Omit<ScriptLine, 'text'> = {}): ScriptLine[] =>
  ['平安', '健康', '内心安宁', '自在'].map(wish => ({
    text: `愿${who}${wish}。`,
    pause: WISH_PAUSE,
    ...only,
  }))

/** 详细档、20 分钟才有的第二轮：提示语用 SLOW_REPEAT，祝愿用 SLOW_ROUND */
const SLOW_REPEAT = { detail: 'detailed', minMinutes: 20 } as const
const SLOW_ROUND = { ...SLOW_REPEAT, pause: SLOW_WISH_PAUSE }

export const lovingKindnessScript: GuidedScript = {
  id: 'loving-kindness',
  title: '慈心',
  minMinutes: 5,
  maxMinutes: 20,
  opening: [
    { text: '这是一段慈心练习。' },
    // 安全提示：开头十秒内开始，紧接着说随时可以换姿势、睁眼或停下，任何档位都说
    { text: '这类练习有时会让人难过，想起过去的伤心事。' },
    { text: '这很常见。' },
    { text: '任何时候，都可以调整姿势、睁开眼睛，或者停下来。' },
    { text: '你会在心里默念几句祝愿，' },
    { text: '从一位亲近的人开始，再到自己和更多的人。' },
    { text: '慈心练习，是有意识地培养善意，', detail: 'standard', minMinutes: 10 },
    { text: '对别人，也对自己。', detail: 'standard', minMinutes: 10 },
    { text: '它和专注力一样，可以慢慢练出来。', detail: 'standard', minMinutes: 20 },
    { text: '刚开始，念起来可能有点生硬。', detail: 'standard' },
    { text: '多练几次，通常会自然一些。', detail: 'standard', minMinutes: 20 },
    { text: '这几句话只是起个头，有一点点善意就够了。' },
    { text: '如果心里已经有了这份善意，不念这些话也可以。', detail: 'detailed', minMinutes: 20 },
    { text: '每一句祝愿后面，都会停几秒。', detail: 'detailed' },
    { text: '你可以在心里跟着念，也可以只是看着。', detail: 'standard', minMinutes: 10 },
    { text: '练习的最后，会留一段安静的时间。', detail: 'detailed', minMinutes: 10 },
  ],
  sections: [
    {
      id: 'settle',
      title: '安顿',
      weight: 0.4,
      minSilence: 2,
      intro: [
        { text: '先找一个舒服的姿势，坐着、躺着都可以。', detail: 'detailed', minMinutes: 10 },
        // 文字引导怎么看：任何档位都说；闭眼和轻响从 10 分钟起说（见文件头）
        { text: '目光落在屏幕上。' },
        { text: '安静久了，可以闭上眼睛，', minMinutes: 10 },
        { text: '轻响一声，再看屏幕。', minMinutes: 10 },
        { text: '坐着的话，让后背稍微挺直，肩膀放松。', detail: 'detailed', minMinutes: 10 },
        { text: '感受身体和椅子、地面接触的地方，', detail: 'standard', minMinutes: 20 },
        { text: '那里的重量，被稳稳地托住。', detail: 'standard', minMinutes: 20 },
        { text: '把注意力放到胸口，心口附近。', pause: 3 },
        { text: '如果你愿意，可以把一只手放在心口，', detail: 'standard', minMinutes: 10 },
        { text: '感受手掌的温度，和一点轻轻的压力。', detail: 'standard', minMinutes: 10 },
        { text: '不想这样做，双手放在腿上也可以。', detail: 'detailed', minMinutes: 10 },
        { text: '再留意一下胸口，', detail: 'standard', minMinutes: 20 },
        { text: '也许是呼吸的起伏，也许是一点暖。', detail: 'standard', minMinutes: 20 },
        { text: '感觉很淡，或者没有感觉，都可以。', detail: 'detailed' },
        // 替代的锚点：任何档位都说
        { text: '如果留意胸口让你不舒服，也可以换成双脚。' },
      ],
    },
    {
      id: 'loved-one',
      title: '亲近的人',
      weight: 1.5,
      minSilence: 6,
      intro: [
        { text: '现在，想起一个让你心里一暖的人。', pause: 3 },
        { text: '可以是一位关系简单的人，或者你养的小动物。', detail: 'standard' },
        { text: '家人、朋友、老师都可以，不一定是最亲的人。', detail: 'standard', minMinutes: 20 },
        { text: '如果想到这个人让你难过，可以换一位。', detail: 'standard' },
        { text: '一时想不起合适的人，', detail: 'detailed', minMinutes: 10 },
        { text: '也可以想一位帮过你的人，哪怕只有一次。', detail: 'detailed', minMinutes: 10 },
        { text: '想象对方就在你面前，或者坐在你身边。', detail: 'standard' },
        { text: '看一看对方的样子，', detail: 'detailed', minMinutes: 20 },
        { text: '也许在笑，也许只是安静地看着你。', detail: 'detailed', minMinutes: 20 },
        { text: '看不清画面不要紧，知道是谁就够了。', detail: 'standard', minMinutes: 10 },
        { text: '留意心里有没有一点暖意。', detail: 'standard' },
        { text: '它可能在胸口，也可能在脸上。', detail: 'detailed', minMinutes: 20 },
        { text: '有，就让它在那里；没有，也没关系。', detail: 'standard' },
        { text: '在心里，把这几句话慢慢说给对方听。' },
        ...wishes('你'),
        { text: '再慢慢说一遍。', ...SLOW_REPEAT },
        ...wishes('你', SLOW_ROUND),
        { text: '心会走神，这很自然。', detail: 'standard' },
        { text: '发现走神，本身就是练习。' },
        { text: '轻轻放下念头，回到这几句话上。' },
        { text: '念着念着，如果变得像背书，就放慢一点。', detail: 'standard', minMinutes: 20 },
        { text: '按你自己的节奏，在心里继续默念。', minMinutes: 10 },
      ],
      reminders: ['愿你平安。愿你自在。', '走神了，就轻轻回到这几句话上。'],
    },
    {
      id: 'self',
      title: '自己',
      weight: 1.6,
      minSilence: 6,
      intro: [
        { text: '想象对方也在这样祝愿你。', pause: 3 },
        { text: '希望你平安，希望你过得好。', detail: 'standard', minMinutes: 20 },
        { text: '你可以把这份祝愿收下。', detail: 'standard', minMinutes: 10 },
        { text: '也许会有一点暖，也许会有点不好意思。', detail: 'standard', minMinutes: 20 },
        { text: '不需要推开它，也不需要抓住它。', detail: 'detailed', minMinutes: 10 },
        { text: '现在，试着把同样的话，说给自己听。' },
        ...wishes('我'),
        { text: '慢一点，再说一遍。', ...SLOW_REPEAT },
        ...wishes('我', SLOW_ROUND),
        { text: '如果对自己说这些话有些困难，' },
        { text: '就让对方的祝愿，落在你身上。' },
        { text: '有人会说不出口，有人会忽然难过，这都很常见。', detail: 'standard' },
        { text: '心里也许会冒出批评自己的声音，', detail: 'standard', minMinutes: 10 },
        { text: '留意到它，然后回到这几句话上。', detail: 'standard', minMinutes: 10 },
        { text: '不管出现什么感觉，都允许它在这里。' },
        { text: '如果情绪太强，' },
        { text: '就先感受双脚，或者听一听周围的声音。' },
        { text: '也可以睁开眼睛，看看四周。', detail: 'standard', minMinutes: 20 },
        { text: '准备好了，再接着默念。', minMinutes: 10 },
      ],
      reminders: ['如果觉得难，就让对方的祝愿落在你身上。', '愿我平安。愿我自在。'],
    },
    {
      id: 'friend',
      title: '朋友',
      weight: 1.1,
      minSilence: 6,
      omitAtOrBelow: 5,
      intro: [
        { text: '接下来，想起一位朋友。', pause: 3 },
        { text: '可以是同事、同学，或者很久没联系的老朋友。', detail: 'standard' },
        { text: '想一想对方最近过得怎么样。', detail: 'standard', minMinutes: 20 },
        { text: '也许此刻正在忙，也许正在休息。', detail: 'detailed', minMinutes: 20 },
        { text: '这位朋友也有自己的烦恼，也想过得好一些。', detail: 'standard' },
        { text: '把同样的祝愿，送给对方。' },
        ...wishes('你'),
      ],
      reminders: ['愿你平安。愿你自在。'],
    },
    {
      id: 'neutral',
      title: '不太熟的人',
      weight: 1.1,
      minSilence: 6,
      omitAtOrBelow: 5,
      intro: [
        { text: '再想起一个你常见到、但不太熟的人。', pause: 3 },
        { text: '比如小区门口的保安，送快递的人，', detail: 'standard' },
        { text: '或者早上和你在同一站等车的人。', detail: 'standard' },
        { text: '你也许连名字都不知道。', detail: 'detailed', minMinutes: 10 },
        { text: '祝愿，不需要知道名字。', detail: 'detailed', minMinutes: 20 },
        { text: '对方和你一样，也会累，也会担心。', detail: 'standard' },
        { text: '也和你一样，希望自己平安。', detail: 'standard' },
        { text: '把同样的祝愿，也送给这个人。' },
        ...wishes('你'),
        { text: '对不太熟的人，心里多半是平平淡淡的。', detail: 'standard', minMinutes: 20 },
        { text: '有点困的话，可以坐直一些，或者睁着眼睛练。', detail: 'standard', minMinutes: 10 },
      ],
      reminders: ['愿你平安。愿你自在。'],
    },
    {
      id: 'difficult',
      title: '有点难相处的人',
      weight: 0.9,
      minSilence: 6,
      omitAtOrBelow: 10,
      skippable: true,
      intro: [
        { text: '下面这一段，可以做，也可以跳过。' },
        // 闭着眼也能跳过：不用按按钮
        { text: '不想做的话，就继续祝愿那位亲近的人。' },
        { text: '如果你愿意，想起一个和你有点小摩擦的人。' },
        { text: '不必是最难的那一个，', detail: 'standard' },
        { text: '但先不要选曾经深深伤害过你的人。', pause: 3 },
        { text: '想到这个人时，留意身体里的反应。', detail: 'standard' },
        { text: '也许胸口发紧，也许肩膀抬了起来。', detail: 'standard' },
        { text: '身体太紧的话，可以先感受双脚，或者睁开眼睛。', detail: 'standard' },
        { text: '心里有抗拒，也允许它在这里。' },
        { text: '这不是要原谅什么，也不是说对方做得对。', detail: 'standard' },
        { text: '只是承认，这个人也想过得好。', detail: 'standard' },
        { text: '愿意的话，试着把祝愿也给对方。' },
        { text: '说不出口的句子，可以跳过。', detail: 'standard' },
        ...wishes('你'),
        { text: '如果觉得太难，就回到那位亲近的人。' },
        { text: '再默念几遍，不用急。', pause: 20 },
        // 只停留一小会儿，余下的静默和亲近的人在一起，再把心意扩展出去
        { text: '现在，回到那位让你心里一暖的人，' },
        { text: '再把祝愿送给对方。' },
      ],
      reminders: ['觉得太难，就感受一下双脚。', '愿你平安。愿你内心安宁。'],
    },
    {
      id: 'all',
      title: '所有生命',
      weight: 1.5,
      minSilence: 6,
      intro: [
        { text: '最后，让这份心意慢慢向外扩展。' },
        { text: '先想到住在你附近的人，', detail: 'standard', minMinutes: 10 },
        { text: '再到这座城市里的人。', detail: 'standard', minMinutes: 10 },
        { text: '还有那些你从没见过的人。', detail: 'standard', minMinutes: 20 },
        { text: '一直到所有的人，所有的生命。' },
        { text: '暂时不想包括的人，可以先放在一边。', detail: 'standard', minMinutes: 20 },
        { text: '你不需要想起每一张脸。', detail: 'detailed', minMinutes: 10 },
        { text: '在心里祝愿他们：' },
        ...wishes('他们'),
        { text: '再说一遍。', ...SLOW_REPEAT },
        ...wishes('他们', SLOW_ROUND),
        { text: '没有特别的感觉，也没关系。' },
        { text: '只是这样祝愿着，就已经是练习了。', detail: 'detailed', minMinutes: 10 },
      ],
      reminders: ['愿他们平安。愿他们自在。'],
    },
    {
      id: 'rest',
      title: '安静片刻',
      weight: 1.5,
      minSilence: 15,
      omitAtOrBelow: 5,
      intro: [
        { text: '现在，可以不再默念了。' },
        { text: '什么也不用做，安静地休息一会儿。' },
        { text: '留意此刻身体里的感觉，', detail: 'standard' },
        { text: '是什么样，就让它是什么样。', detail: 'standard' },
        { text: '心里如果还在默念，就让它自己慢慢停下来。', detail: 'detailed' },
      ],
    },
  ],
  closing: [
    { text: '练习快要结束了。', detail: 'standard', minMinutes: 10 },
    { text: '今天接下来的时间里，如果想起来，', detail: 'standard', minMinutes: 10 },
    { text: '可以在心里对身边的某个人说：愿你平安。', detail: 'standard', minMinutes: 10 },
    { text: '先动一动手指，感受一下身体的重量。', detail: 'detailed', minMinutes: 10 },
    { text: '准备好时，抬起目光，看看四周。' },
  ],
}
