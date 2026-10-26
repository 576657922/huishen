import japanese from '../locales/ja/scripts-loving-kindness.json'
import { createTranslator } from '../translate'

const tr = createTranslator(japanese)

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
const wishes = (who: string, only: Omit<ScriptLine, 'text'> = {}): ScriptLine[] =>
  [tr('平安'), tr('健康'), tr('内心安宁'), tr('自在')].map(wish => ({
    text: tr('愿{0}{1}。', who, wish),
    pause: WISH_PAUSE,
    ...only,
  }))

/** 详细档、20 分钟才有的第二轮：提示语用 SLOW_REPEAT，祝愿用 SLOW_ROUND */
const SLOW_REPEAT = { detail: 'detailed', minMinutes: 20 } as const
const SLOW_ROUND = { ...SLOW_REPEAT, pause: SLOW_WISH_PAUSE }

export const lovingKindnessScript: GuidedScript = {
  id: 'loving-kindness',
  title: tr('慈心'),
  minMinutes: 5,
  maxMinutes: 20,
  opening: [
    { text: tr('这是一段慈心练习。') },
    // 安全提示：开头十秒内开始，紧接着说随时可以换姿势、睁眼或停下，任何档位都说
    { text: tr('这类练习有时会让人难过，想起过去的伤心事。') },
    { text: tr('这很常见。') },
    { text: tr('任何时候，都可以调整姿势、睁开眼睛，或者停下来。') },
    { text: tr('你会在心里默念几句祝愿，') },
    { text: tr('从一位亲近的人开始，再到自己和更多的人。') },
    { text: tr('慈心练习，是有意识地培养善意，'), detail: 'standard', minMinutes: 10 },
    { text: tr('对别人，也对自己。'), detail: 'standard', minMinutes: 10 },
    { text: tr('它和专注力一样，可以慢慢练出来。'), detail: 'standard', minMinutes: 20 },
    { text: tr('刚开始，念起来可能有点生硬。'), detail: 'standard' },
    { text: tr('多练几次，通常会自然一些。'), detail: 'standard', minMinutes: 20 },
    { text: tr('这几句话只是起个头，有一点点善意就够了。') },
    { text: tr('如果心里已经有了这份善意，不念这些话也可以。'), detail: 'detailed', minMinutes: 20 },
    { text: tr('每一句祝愿后面，都会停几秒。'), detail: 'detailed' },
    { text: tr('你可以在心里跟着念，也可以只是看着。'), detail: 'standard', minMinutes: 10 },
    { text: tr('练习的最后，会留一段安静的时间。'), detail: 'detailed', minMinutes: 10 },
  ],
  sections: [
    {
      id: 'settle',
      title: tr('安顿'),
      weight: 0.4,
      minSilence: 2,
      intro: [
        { text: tr('先找一个舒服的姿势，坐着、躺着都可以。'), detail: 'detailed', minMinutes: 10 },
        // 文字引导怎么看：任何档位都说；闭眼和轻响从 10 分钟起说（见文件头）
        { text: tr('目光落在屏幕上。') },
        { text: tr('安静久了，可以闭上眼睛，'), minMinutes: 10 },
        { text: tr('轻响一声，再看屏幕。'), minMinutes: 10 },
        { text: tr('坐着的话，让后背稍微挺直，肩膀放松。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('感受身体和椅子、地面接触的地方，'), detail: 'standard', minMinutes: 20 },
        { text: tr('那里的重量，被稳稳地托住。'), detail: 'standard', minMinutes: 20 },
        { text: tr('把注意力放到胸口，心口附近。'), pause: 3 },
        { text: tr('如果你愿意，可以把一只手放在心口，'), detail: 'standard', minMinutes: 10 },
        { text: tr('感受手掌的温度，和一点轻轻的压力。'), detail: 'standard', minMinutes: 10 },
        { text: tr('不想这样做，双手放在腿上也可以。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('再留意一下胸口，'), detail: 'standard', minMinutes: 20 },
        { text: tr('也许是呼吸的起伏，也许是一点暖。'), detail: 'standard', minMinutes: 20 },
        { text: tr('感觉很淡，或者没有感觉，都可以。'), detail: 'detailed' },
        // 替代的锚点：任何档位都说
        { text: tr('如果留意胸口让你不舒服，也可以换成双脚。') },
      ],
    },
    {
      id: 'loved-one',
      title: tr('亲近的人'),
      weight: 1.5,
      minSilence: 6,
      intro: [
        { text: tr('现在，想起一个让你心里一暖的人。'), pause: 3 },
        { text: tr('可以是一位关系简单的人，或者你养的小动物。'), detail: 'standard' },
        { text: tr('家人、朋友、老师都可以，不一定是最亲的人。'), detail: 'standard', minMinutes: 20 },
        { text: tr('如果想到这个人让你难过，可以换一位。'), detail: 'standard' },
        { text: tr('一时想不起合适的人，'), detail: 'detailed', minMinutes: 10 },
        { text: tr('也可以想一位帮过你的人，哪怕只有一次。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('想象对方就在你面前，或者坐在你身边。'), detail: 'standard' },
        { text: tr('看一看对方的样子，'), detail: 'detailed', minMinutes: 20 },
        { text: tr('也许在笑，也许只是安静地看着你。'), detail: 'detailed', minMinutes: 20 },
        { text: tr('看不清画面不要紧，知道是谁就够了。'), detail: 'standard', minMinutes: 10 },
        { text: tr('留意心里有没有一点暖意。'), detail: 'standard' },
        { text: tr('它可能在胸口，也可能在脸上。'), detail: 'detailed', minMinutes: 20 },
        { text: tr('有，就让它在那里；没有，也没关系。'), detail: 'standard' },
        { text: tr('在心里，把这几句话慢慢说给对方听。') },
        ...wishes(tr('你')),
        { text: tr('再慢慢说一遍。'), ...SLOW_REPEAT },
        ...wishes(tr('你'), SLOW_ROUND),
        { text: tr('心会走神，这很自然。'), detail: 'standard' },
        { text: tr('发现走神，本身就是练习。') },
        { text: tr('轻轻放下念头，回到这几句话上。') },
        { text: tr('念着念着，如果变得像背书，就放慢一点。'), detail: 'standard', minMinutes: 20 },
        { text: tr('按你自己的节奏，在心里继续默念。'), minMinutes: 10 },
      ],
      reminders: [tr('愿你平安。愿你自在。'), tr('走神了，就轻轻回到这几句话上。')],
    },
    {
      id: 'self',
      title: tr('自己'),
      weight: 1.6,
      minSilence: 6,
      intro: [
        { text: tr('想象对方也在这样祝愿你。'), pause: 3 },
        { text: tr('希望你平安，希望你过得好。'), detail: 'standard', minMinutes: 20 },
        { text: tr('你可以把这份祝愿收下。'), detail: 'standard', minMinutes: 10 },
        { text: tr('也许会有一点暖，也许会有点不好意思。'), detail: 'standard', minMinutes: 20 },
        { text: tr('不需要推开它，也不需要抓住它。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('现在，试着把同样的话，说给自己听。') },
        ...wishes(tr('我')),
        { text: tr('慢一点，再说一遍。'), ...SLOW_REPEAT },
        ...wishes(tr('我'), SLOW_ROUND),
        { text: tr('如果对自己说这些话有些困难，') },
        { text: tr('就让对方的祝愿，落在你身上。') },
        { text: tr('有人会说不出口，有人会忽然难过，这都很常见。'), detail: 'standard' },
        { text: tr('心里也许会冒出批评自己的声音，'), detail: 'standard', minMinutes: 10 },
        { text: tr('留意到它，然后回到这几句话上。'), detail: 'standard', minMinutes: 10 },
        { text: tr('不管出现什么感觉，都允许它在这里。') },
        { text: tr('如果情绪太强，') },
        { text: tr('就先感受双脚，或者听一听周围的声音。') },
        { text: tr('也可以睁开眼睛，看看四周。'), detail: 'standard', minMinutes: 20 },
        { text: tr('准备好了，再接着默念。'), minMinutes: 10 },
      ],
      reminders: [tr('如果觉得难，就让对方的祝愿落在你身上。'), tr('愿我平安。愿我自在。')],
    },
    {
      id: 'friend',
      title: tr('朋友'),
      weight: 1.1,
      minSilence: 6,
      omitAtOrBelow: 5,
      intro: [
        { text: tr('接下来，想起一位朋友。'), pause: 3 },
        { text: tr('可以是同事、同学，或者很久没联系的老朋友。'), detail: 'standard' },
        { text: tr('想一想对方最近过得怎么样。'), detail: 'standard', minMinutes: 20 },
        { text: tr('也许此刻正在忙，也许正在休息。'), detail: 'detailed', minMinutes: 20 },
        { text: tr('这位朋友也有自己的烦恼，也想过得好一些。'), detail: 'standard' },
        { text: tr('把同样的祝愿，送给对方。') },
        ...wishes(tr('你')),
      ],
      reminders: [tr('愿你平安。愿你自在。')],
    },
    {
      id: 'neutral',
      title: tr('不太熟的人'),
      weight: 1.1,
      minSilence: 6,
      omitAtOrBelow: 5,
      intro: [
        { text: tr('再想起一个你常见到、但不太熟的人。'), pause: 3 },
        { text: tr('比如小区门口的保安，送快递的人，'), detail: 'standard' },
        { text: tr('或者早上和你在同一站等车的人。'), detail: 'standard' },
        { text: tr('你也许连名字都不知道。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('祝愿，不需要知道名字。'), detail: 'detailed', minMinutes: 20 },
        { text: tr('对方和你一样，也会累，也会担心。'), detail: 'standard' },
        { text: tr('也和你一样，希望自己平安。'), detail: 'standard' },
        { text: tr('把同样的祝愿，也送给这个人。') },
        ...wishes(tr('你')),
        { text: tr('对不太熟的人，心里多半是平平淡淡的。'), detail: 'standard', minMinutes: 20 },
        { text: tr('有点困的话，可以坐直一些，或者睁着眼睛练。'), detail: 'standard', minMinutes: 10 },
      ],
      reminders: [tr('愿你平安。愿你自在。')],
    },
    {
      id: 'difficult',
      title: tr('有点难相处的人'),
      weight: 0.9,
      minSilence: 6,
      omitAtOrBelow: 10,
      skippable: true,
      intro: [
        { text: tr('下面这一段，可以做，也可以跳过。') },
        // 闭着眼也能跳过：不用按按钮
        { text: tr('不想做的话，就继续祝愿那位亲近的人。') },
        { text: tr('如果你愿意，想起一个和你有点小摩擦的人。') },
        { text: tr('不必是最难的那一个，'), detail: 'standard' },
        { text: tr('但先不要选曾经深深伤害过你的人。'), pause: 3 },
        { text: tr('想到这个人时，留意身体里的反应。'), detail: 'standard' },
        { text: tr('也许胸口发紧，也许肩膀抬了起来。'), detail: 'standard' },
        { text: tr('身体太紧的话，可以先感受双脚，或者睁开眼睛。'), detail: 'standard' },
        { text: tr('心里有抗拒，也允许它在这里。') },
        { text: tr('这不是要原谅什么，也不是说对方做得对。'), detail: 'standard' },
        { text: tr('只是承认，这个人也想过得好。'), detail: 'standard' },
        { text: tr('愿意的话，试着把祝愿也给对方。') },
        { text: tr('说不出口的句子，可以跳过。'), detail: 'standard' },
        ...wishes(tr('你')),
        { text: tr('如果觉得太难，就回到那位亲近的人。') },
        { text: tr('再默念几遍，不用急。'), pause: 20 },
        // 只停留一小会儿，余下的静默和亲近的人在一起，再把心意扩展出去
        { text: tr('现在，回到那位让你心里一暖的人，') },
        { text: tr('再把祝愿送给对方。') },
      ],
      reminders: [tr('觉得太难，就感受一下双脚。'), tr('愿你平安。愿你内心安宁。')],
    },
    {
      id: 'all',
      title: tr('所有生命'),
      weight: 1.5,
      minSilence: 6,
      intro: [
        { text: tr('最后，让这份心意慢慢向外扩展。') },
        { text: tr('先想到住在你附近的人，'), detail: 'standard', minMinutes: 10 },
        { text: tr('再到这座城市里的人。'), detail: 'standard', minMinutes: 10 },
        { text: tr('还有那些你从没见过的人。'), detail: 'standard', minMinutes: 20 },
        { text: tr('一直到所有的人，所有的生命。') },
        { text: tr('暂时不想包括的人，可以先放在一边。'), detail: 'standard', minMinutes: 20 },
        { text: tr('你不需要想起每一张脸。'), detail: 'detailed', minMinutes: 10 },
        { text: tr('在心里祝愿他们：') },
        ...wishes(tr('他们')),
        { text: tr('再说一遍。'), ...SLOW_REPEAT },
        ...wishes(tr('他们'), SLOW_ROUND),
        { text: tr('没有特别的感觉，也没关系。') },
        { text: tr('只是这样祝愿着，就已经是练习了。'), detail: 'detailed', minMinutes: 10 },
      ],
      reminders: [tr('愿他们平安。愿他们自在。')],
    },
    {
      id: 'rest',
      title: tr('安静片刻'),
      weight: 1.5,
      minSilence: 15,
      omitAtOrBelow: 5,
      intro: [
        { text: tr('现在，可以不再默念了。') },
        { text: tr('什么也不用做，安静地休息一会儿。') },
        { text: tr('留意此刻身体里的感觉，'), detail: 'standard' },
        { text: tr('是什么样，就让它是什么样。'), detail: 'standard' },
        { text: tr('心里如果还在默念，就让它自己慢慢停下来。'), detail: 'detailed' },
      ],
    },
  ],
  closing: [
    { text: tr('练习快要结束了。'), detail: 'standard', minMinutes: 10 },
    { text: tr('今天接下来的时间里，如果想起来，'), detail: 'standard', minMinutes: 10 },
    { text: tr('可以在心里对身边的某个人说：愿你平安。'), detail: 'standard', minMinutes: 10 },
    { text: tr('先动一动手指，感受一下身体的重量。'), detail: 'detailed', minMinutes: 10 },
    { text: tr('准备好时，抬起目光，看看四周。') },
  ],
}
