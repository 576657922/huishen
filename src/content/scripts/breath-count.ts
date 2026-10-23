/**
 * 数息（5 / 10 / 15 分钟）。原创中文引导词，只沿用公开的练习结构和任务规则，不翻译、不改写任何现成录音。
 *
 * 结构依据：
 * - practice-levinson-2014、meditation-levinson-2014：一吸一呼算一口气，从一数到九再回到一；
 *   第一到第八口气点一个键，第九口气点另一个键；数乱了点「数乱了」，从下一口气重新数一。
 * - meditation-wong-2018：指导语要点——感受鼻孔与上唇之间的气息、不控制呼吸、只在心里数不用手指、
 *   眼睛至少半睁。自己发现的「数乱了」与走神有关，没察觉的数错与注意力短暂失灵有关，两者分开显示。
 * - meditation-treves-2025：结果不能称为「正念分数」；引导词里不评价数得准不准，数据怎么看放在结果页说明。
 * - meditation-hasenkamp-2012：走神 → 发现 → 轻轻放下 → 回来；发现走神本身就是练习（回神）。
 * - meditation-lindsay-2018：每次练习都明确教接纳（允许、不用赶走）。
 * - practice-baer-2019、practice-santorelli-2017：邀请而不是要求，随时可以调整姿势或停下。
 * - practice-deroche-2025：呼吸以外的锚点（脚底、周围的声音），在不适时使用。
 * - safety-britton-2021、safety-nccih-2021-relaxation：停止指引——头晕、心慌、很不舒服时停下，
 *   把注意力放到脚底或声音上；开头三十秒内说完。
 * - practice-uclamarc-2016：守住一个对象的练习人声最稀疏。
 *
 * 时间结构（practice.notes §2.7）：到达 → 讲解（10 分钟起示范一轮）→ 自己数（提醒很少）→ 放下数字 → 结束。
 * 每段开头有段落提示音（5 分钟版三段，10、15 分钟版四段）：第一声是开始数的信号，
 * 中间的提示音后面只跟一句简短、各档位相同的提醒，最后一声表示可以停了。
 * 犯困、无聊、拿不准数到几这些情况都在开头讲完，计数期间不再讲：
 * 计数中的话会打断默数，档位不同听到的又不一样，测出来的数据就没法比较。
 * 讲规则之前先说「现在还不用点」，免得跟着示范点屏幕，在开始计数之前就记下错误。
 *
 * 15 分钟版用于测量，但计数窗口约 10.5–13 分钟（详细档最短，安静档最长），比研究 2 的 15 分钟短，
 * 只能与同档位的 15 分钟练习比较，不能直接对照文献数值。5、10 分钟只算练习。
 * 人声占比目标（标准档；人声 = 朗读加句后的说话停顿，口径见 scripts.test.ts）：5 分钟约 25%，10 分钟约 18%，
 * 15 分钟约 15%（在 10、20 分钟的模板之间内插）。按时间线估算约 37%、28%、19%：任务规则和停止指引是必说的，
 * 短时长下它们本身就占去大半。所以 5 分钟的标准档只比安静档多一句「数着数着走神了」，示范一轮、手机放哪儿、
 * 感觉很淡、无聊烦躁和结尾的回顾都从 10 分钟起才说，把时间留给计数；目光落在哪里、气息的凉暖只在详细档说。
 *
 * v1 是文字引导（PRODUCT.md §0、§5）：引导一句一句出现在屏幕上，手机放在腿上，半睁的目光正好落在屏幕上；
 * 这个练习全程睁着眼，不提闭眼。计数中只有段落开头的一句，安静了很久才出现，设置开着时会有一声轻响。
 * say 留给以后的真人录音：「数息」「数乱了」「心里数」与前后字连读时容易听错（如「心里数」听成「心里有数」的数），
 * 这些句子念的时候换一种说法；屏幕上仍显示按钮上的字。
 */
import type { GuidedScript } from '@/content/types'

export const breathCountScript: GuidedScript = {
  id: 'breath-count',
  title: '数息',
  minMinutes: 5,
  maxMinutes: 15,
  opening: [
    // 到达：命名、坐姿
    { text: '这是数息练习。', say: '这是数呼吸的练习。' },
    { text: '找一个舒服、挺直的坐姿。' },
    // 停止指引：先给无条件的许可，再说出现不适时怎么做
    { text: '任何时候，都可以调整姿势，或者停下来。' },
    { text: '如果头晕、心慌，或者很不舒服，就停下来，' },
    { text: '把注意力放到脚底，或者周围的声音上。' },
    // 眼睛和手机，再安顿身体。文字引导：目光落在屏幕上，全程不闭眼（meditation-wong-2018：至少半睁）
    { text: '这个练习睁着眼做，目光落在屏幕上。' },
    { text: '眼睛半睁就可以，视线放松一些。', detail: 'detailed', minMinutes: 10 },
    { text: '手机可以放在腿上，左右两边都好点。', detail: 'standard', minMinutes: 10 },
    { text: '坐椅子的话，可以不靠椅背。', detail: 'detailed', minMinutes: 10 },
    { text: '肩膀放下来，手臂不用使劲。', detail: 'detailed', minMinutes: 10 },
    { text: '感受身体的重量落在座位上，', detail: 'standard', minMinutes: 10 },
    { text: '双脚踩着地面。', detail: 'standard', minMinutes: 10, pause: 3 },
    // 找到呼吸：留出一两口气的时间去感受
    { text: '感受鼻孔和上唇之间，气息进来、出去。', pause: 7 },
    { text: '吸气时也许凉一点，呼气时暖一点。', detail: 'detailed', minMinutes: 10, pause: 4 },
    { text: '如果感觉很淡，也没关系。', detail: 'standard', minMinutes: 10 },
    { text: '不需要控制呼吸，快也好，慢也好，都允许。' },
    { text: '呼吸有长有短，有时会停一下，都很自然。', detail: 'detailed', minMinutes: 10 },
    // 怎么数：规则和一轮示范
    { text: '先看一遍做法，现在还不用点。' },
    { text: '一吸一呼，算一口气。' },
    { text: '每次呼气结束，心里念一个数字。' },
    { text: '不用赶，等呼气自然结束再念。', detail: 'detailed' },
    { text: '第一到第八口气，点左边；' },
    { text: '第九口气，点右边，然后回到「一」。', pause: 3 },
    { text: '就像这样：八，左边；九，右边；一，左边。', detail: 'standard', minMinutes: 10 },
    { text: '只在心里数，不用掰手指。', say: '只在心里默念，不用掰手指。' },
    { text: '注意力在呼吸上，数字只是轻轻跟着。', detail: 'standard', minMinutes: 10 },
    { text: '数字一乱，往往就是走神了。', detail: 'detailed', minMinutes: 10 },
    // 走神与回神
    { text: '数着数着走神了，这很自然。', detail: 'standard' },
    { text: '刚开始，常常数不到九就走神。', detail: 'detailed' },
    { text: '忘了数到几，或者数过了九，' },
    {
      text: '就轻轻放下念头，点下方的「数乱了」，回到「一」。',
      say: '就轻轻放下念头，点下方的按钮，回到一。',
    },
    { text: '拿不准数到几，也点「数乱了」。', detail: 'detailed', say: '拿不准数到几，也点下方的按钮。' },
    { text: '发现走神的那一刻，就是回神。', pause: 3 },
    // 计数中可能遇到的情况，在这里先说
    { text: '中途犯困，可以把眼睛睁大一点。', detail: 'standard', minMinutes: 10 },
    { text: '无聊、烦躁也会来，不用赶它走。', detail: 'standard', minMinutes: 10 },
    { text: '发现自己在控制呼吸，就放开它。', detail: 'detailed', minMinutes: 10 },
    // 开始
    { text: '接下来大多是安静的。', detail: 'standard', minMinutes: 10 },
    { text: '听到提示音，就开始数。' },
  ],
  // 计数中的三段都叫「数息」：播放器上的段落名保持不变，免得看到别的字样，误以为要从头数。
  // 这三段开头的话都是 core 的短句，不问数到几，任何档位听到的都一样
  sections: [
    {
      id: 'count',
      title: '数息',
      weight: 1,
      minSilence: 40,
      intro: [{ text: '下一口气，就是「一」。' }],
    },
    {
      id: 'recount',
      title: '数息',
      weight: 1,
      minSilence: 40,
      intro: [{ text: '接着往下数。' }],
    },
    {
      id: 'steady',
      title: '数息',
      weight: 0.85,
      minSilence: 40,
      omitAtOrBelow: 5,
      intro: [{ text: '感受着气息，接着数下去。' }],
    },
    {
      id: 'release',
      title: '放下数字',
      // 权重为 0：停止计数后只留固定的一小段安静，不随时长变长，把时间留给计数
      weight: 0,
      minSilence: 10,
      intro: [
        { text: '数到这里就好，屏幕也不用再点了。' },
        { text: '把注意力放宽，感受整个身体坐在这里。', detail: 'standard', minMinutes: 10, pause: 8 },
      ],
    },
  ],
  closing: [
    { text: '留意一下此刻的感觉，不需要评判它。', detail: 'detailed', minMinutes: 10 },
    { text: '刚才每一次发现走神，都是一次回神。', detail: 'standard', minMinutes: 10 },
    { text: '等钟声响起，再慢慢活动身体。' },
  ],
}
