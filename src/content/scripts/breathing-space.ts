/**
 * 呼吸空间：标准三步版、入门两步版、应对版。原创中文引导词，只沿用公开的练习结构，不翻译、不改写任何现成录音。
 *
 * 结构依据：
 * - practice-deroche-2025：三步「沙漏」，觉察 → 集中 → 扩展，示意为三分钟；第二步的锚点可以换成双脚、双手或座位接触。
 * - practice-mander-2019：入门两步版，先收窄到呼吸，再扩展到全身；经验少的人更容易上手。
 * - 应对版（Hanssen 2019，见 practice.notes §2.2）：第一步给体验命名，找到它在身体的位置；第三步把难受的感受包括进来；以「怎样照顾自己」收尾。
 * - practice-santorelli-2017、practice-baer-2019：邀请而不是要求；随时可以调整、睁眼或停下；太强烈时回到双脚。
 *   任何档位都会提到双脚：标准版在开头的安全提示和第二步，入门版在第二步，应对版在转向难受的两处。
 * - meditation-lindsay-2018：每次都明确教接纳（允许、不评判、不需要改变它）。
 * - meditation-hasenkamp-2012：走神 → 发现 → 轻轻放下 → 回来；发现走神本身就是练习。
 * - safety-szulczewski-2019：不提示深呼吸，只说不需要控制呼吸。
 * - practice-uclamarc-2016：人声占比按模板设定。sound-knowlton-2006：停顿随练习推进变长，
 *   第一步的提问之间约五六秒，第二步选好锚点后约八秒，再进入各段最长的静默。
 * 证据：应用内等级 C，依据短程正念训练（meditation-schumer-2018，校正发表偏倚后效应接近零）；
 * 单独的三分钟呼吸空间还没有找到随机试验，五分钟改编版加在治疗开头也没有优于放松（practice-mander-2019）。引导词里不提任何效果。
 *
 * 人声占比目标（标准档）。口径：朗读时长加句后的说话停顿，全部引导词统一（见 scripts.test.ts）。
 * 这是估算；practice.notes §1 要求成品音频用语音活动检测复核，按纯发声算要低十几个百分点（三分钟标准档约 42%）。
 * - 标准版：三分钟约 55%；十分钟约 40%。十分钟的模板是每步 2:30 / 3:30 / 3:00 加一分钟收尾，
 *   这里第一步连开场约 2:50，收尾的话约四十秒；安静档的第一步约一分钟（觉察的权重为 2）。
 *   十分钟多出的引导用 minMinutes 标出：标准档的在八分钟起说，详细档的在十分钟才说。只为三分钟和十分钟调过时间。
 *   三分钟的静默已在各段下限，详细档与标准档相同，再多说一句就要压缩静默。
 * - 入门两步版：五分钟约 45%。标准档第一步的长静默中间有一条提醒，静默比插入提醒的门槛长七八秒，不靠临界值。
 *   详细档多出的句子后面只停四到六秒，把时间留给各段末尾的静默，不压到下限以下。
 * - 应对版在难受的时候用。practice-baer-2019 和三档表都要求困扰时连续引导、不留长静默，
 *   所以安静档与标准档相同（三分钟时三档都相同），任何档位的静默都不超过半分钟：三分钟约 65%，四分钟约 60%，五分钟约 55%。
 *
 * v1 是文字引导（PRODUCT.md §0、§5），三个版本各在开头说一次怎么看：
 * - 标准版：目光落在屏幕上。三分钟版几乎没有二十秒以上的安静，十分钟版才有，所以闭眼和轻响从八分钟起说。
 * - 入门两步版：每一步末尾都有长的安静，闭眼和轻响任何档位都说；位置在安全提示之前，安全提示仍在开头半分钟内。
 *   详细档开头原有一句两步的概述（「先集中到呼吸，再扩展到整个身体」），屏幕上的段落条已经写着「集中 · 扩展」，
 *   删去这一句，把时间留给怎么看屏幕，各段的静默才不压到下限以下。
 *   原来结尾的「如果闭着眼睛，准备好时再慢慢睁开」读的时候眼睛是睁着的，改为「抬起目光」。
 * - 应对版：难受时睁着眼练更稳（safety.notes §7），而且话一直不断，所以只请人睁着眼看屏幕，不提闭眼。
 */
import type { GuidedScript } from '@/content/types'

export const breathingSpaceScript: GuidedScript = {
  id: 'breathing-space',
  title: '呼吸空间',
  minMinutes: 3,
  maxMinutes: 10,
  opening: [
    { text: '这是呼吸空间练习，一共三步。' },
    { text: '后背挺直，但不僵硬。' },
    // 文字引导怎么看：任何档位都说；闭眼和轻响只在十分钟版说（见文件头）
    { text: '目光放低，落在屏幕上就好。' },
    { text: '安静时可以闭上眼睛，', minMinutes: 8 },
    { text: '听到轻响，再看屏幕。', minMinutes: 8 },
    { text: '任何时候不舒服，' },
    { text: '都可以睁开眼睛、感受双脚，或者停下来。' },
    { text: '先觉察此刻，再集中到呼吸，最后扩展到全身。', detail: 'detailed', minMinutes: 8 },
    { text: '每一步里，都会留出比较长的安静。', detail: 'standard', minMinutes: 8 },
    { text: '感受身体的重量，落在座位和地面上。', detail: 'standard', minMinutes: 8, pause: 6 },
  ],
  sections: [
    {
      id: 'aware',
      title: '觉察',
      weight: 2,
      minSilence: 2,
      intro: [
        { text: '第一步，问问自己：此刻，我正在经历什么？', pause: 5 },
        { text: '不用急着回答，只是看一看。', detail: 'standard', minMinutes: 8, pause: 8 },

        { text: '有什么念头？看着它们来，也看着它们走。', detail: 'standard', pause: 6 },
        { text: '念头可能是计划、回忆，或者评价。', detail: 'detailed', minMinutes: 10, pause: 6 },
        { text: '可以在心里说一句：这是一个念头。', detail: 'standard', minMinutes: 8, pause: 8 },

        { text: '有什么情绪？愉快的、不愉快的，都算。', detail: 'standard', pause: 6 },
        { text: '情绪可能很淡，也可能很明显。', detail: 'detailed', minMinutes: 10, pause: 6 },
        { text: '难受的情绪，也承认它在，不急着推开。', detail: 'standard', minMinutes: 8, pause: 6 },
        { text: '如果某种感受太强烈，可以先回到双脚。', detail: 'standard', minMinutes: 8, pause: 6 },

        { text: '身体有什么感觉？发紧、发沉，还是没什么感觉？', detail: 'standard', pause: 6 },
        { text: '可以从头到脚快速扫一遍，看看哪里在用力。', detail: 'standard', minMinutes: 8, pause: 10 },
        { text: '没有明显的感觉，也没关系。', detail: 'standard', minMinutes: 8 },

        { text: '无论发现什么，都允许它在这里。' },
        { text: '只是承认，不评判，也不需要改变它。', detail: 'standard', minMinutes: 8 },
      ],
      reminders: ['此刻有什么，就承认什么。', '念头、情绪、身体的感觉，看见就好。'],
    },
    {
      id: 'gather',
      title: '集中',
      weight: 10,
      minSilence: 8,
      intro: [
        { text: '第二步，把注意力集中到呼吸上。' },
        { text: '感受腹部随着呼吸，轻轻起伏。', pause: 5 },
        { text: '不需要控制呼吸，让它自然进出。' },
        { text: '如果留意呼吸让你紧张，' },
        { text: '可以把注意力放在双脚或双手上。', pause: 8 },
        { text: '选了双脚的话，就留意脚底踩着地面的压力。', detail: 'detailed', minMinutes: 10, pause: 6 },

        { text: '走神了，发现了，就轻轻放下念头，回到这里。' },
        { text: '发现走神，本身就是练习。', pause: 8 },

        { text: '留在呼吸上的话，跟着一次吸气，从开始到结束。', detail: 'standard', minMinutes: 8, pause: 6 },
        { text: '再跟着一次呼气，一直到结束。', detail: 'standard', minMinutes: 8, pause: 10 },
        { text: '呼气结束后，也许有一个短短的停顿。', detail: 'detailed', minMinutes: 10, pause: 12 },
        { text: '每一次呼吸都有点不同，不需要让它们一样。', detail: 'standard', minMinutes: 8, pause: 10 },
        { text: '如果呼吸很浅，或者有点急，也没关系。', detail: 'detailed', minMinutes: 10, pause: 15 },
        { text: '如果有点困，可以睁着眼睛，坐直一些。', detail: 'standard', minMinutes: 8, pause: 10 },

        { text: '注意力可能一次次跑开，这很自然。', detail: 'detailed', minMinutes: 10, pause: 6 },
        { text: '跑开的时候，也可以在心里默念：走神。', detail: 'standard', minMinutes: 8, pause: 18 },
        { text: '再回到呼吸，或者回到双脚。', detail: 'detailed', minMinutes: 10, pause: 18 },
      ],
      reminders: [
        '注意力跑开了，就带它回来。',
        '发现走神的那一刻，就是回神。',
        '轻轻回到呼吸或双脚。',
        '不需要控制呼吸，只是感受它。',
      ],
    },
    {
      id: 'expand',
      title: '扩展',
      weight: 11,
      minSilence: 10,
      intro: [
        { text: '第三步，把觉察扩展到整个身体。' },
        { text: '感受整个身体，好像都在呼吸。', pause: 4 },
        { text: '也留意姿势，还有脸上的表情。', detail: 'standard' },
        {
          text: '皮肤的感觉，衣服的触感，空气的温度，都可以留意。',
          detail: 'standard',
          minMinutes: 8,
          pause: 8,
        },
        { text: '把肩膀、手臂和双手，也包括进来。', detail: 'detailed', minMinutes: 10, pause: 10 },
        { text: '再把双腿和双脚，也包括进来。', detail: 'detailed', minMinutes: 10, pause: 12 },

        { text: '哪里紧绷，可以把呼吸带到那里。', detail: 'standard', minMinutes: 8 },
        { text: '吸气时感受那里，呼气时，看看能不能松一点。', detail: 'standard', minMinutes: 8, pause: 8 },
        { text: '松不开也没关系，允许它保持原样。', detail: 'standard', minMinutes: 8, pause: 10 },

        { text: '再回到整个身体，从头顶到脚底。', detail: 'standard', minMinutes: 8, pause: 10 },
        { text: '如果注意力被某个感觉吸走，就再把觉察放宽。', detail: 'standard', minMinutes: 8, pause: 10 },
        { text: '也可以把周围的声音包括进来。', detail: 'detailed', minMinutes: 10, pause: 15 },
        { text: '听见声音，也感觉到身体和呼吸。', detail: 'detailed', minMinutes: 10 },
      ],
      reminders: [
        '有什么感觉，就让它在那里。',
        '肩膀、双手、双脚，都在这里。',
        '注意力收窄了，就再放宽一些。',
      ],
    },
  ],
  closing: [
    { text: '练习快要结束了。', detail: 'standard', minMinutes: 8 },
    { text: '回想一下刚才的三步：觉察、集中、扩展。', detail: 'standard', minMinutes: 8, pause: 4 },
    { text: '这三步随时都可以做，哪怕只有一分钟。', detail: 'standard', minMinutes: 8 },
    { text: '可以动一动手指，准备好时再抬起目光。', detail: 'standard', minMinutes: 8 },
    { text: '带着这份更宽的觉察，进入下一刻。' },
  ],
}

export const breathingSpaceIntroScript: GuidedScript = {
  id: 'breathing-space-intro',
  title: '呼吸空间 · 入门两步版',
  minMinutes: 5,
  maxMinutes: 5,
  opening: [
    { text: '这是呼吸空间练习，先从两步开始。' },
    { text: '可以坐着，双脚平放在地上。' },
    { text: '后背挺直，但不僵硬。' },
    // 文字引导怎么看：任何档位都说（见文件头）
    { text: '目光放低，落在屏幕上；' },
    { text: '安静的时候，可以闭上眼睛，' },
    { text: '听到一声轻响，就看一眼屏幕。' },
    { text: '任何时候，都可以调整姿势、睁开眼睛，或者停下来。' },
    { text: '感受身体的重量，落在座位和地面上。', detail: 'detailed', pause: 4 },
  ],
  sections: [
    {
      id: 'gather',
      title: '集中',
      weight: 6,
      minSilence: 20,
      intro: [
        { text: '第一步，把注意力集中到呼吸上。' },
        { text: '感受腹部随着呼吸，轻轻起伏。', pause: 6 },
        { text: '不需要控制呼吸，让它自然进出。', pause: 8 },
        { text: '如果留意呼吸让你紧张，' },
        { text: '可以把注意力放在双脚或双手上。', pause: 8 },
        { text: '选了双脚的话，就留意脚底踩着地面的压力。', detail: 'detailed', pause: 4 },

        { text: '留在呼吸上的话，跟着一次吸气，从开始到结束。', detail: 'standard', pause: 6 },
        { text: '再跟着一次呼气，一直到结束。', detail: 'standard', pause: 12 },
        { text: '觉得没意思也很常见，呼吸本来就很平常。', detail: 'detailed', pause: 6 },
        { text: '如果有点困，可以睁着眼睛，坐直一些。', detail: 'standard', pause: 4 },

        { text: '心会走神，这很自然。' },
        { text: '发现了，就轻轻放下念头，回到这里。', pause: 8 },
        { text: '发现走神，本身就是练习。', pause: 6 },
        { text: '走神多少次都没关系，不需要责怪自己。', detail: 'detailed', pause: 6 },
        { text: '再回到呼吸，或者回到双脚。', detail: 'detailed', pause: 6 },
      ],
      reminders: [
        '走神了，就轻轻回到呼吸或双脚。',
        '发现走神的那一刻，就是回神。',
        '不需要控制呼吸，只是感受它。',
      ],
    },
    {
      id: 'expand',
      title: '扩展',
      weight: 1,
      minSilence: 10,
      intro: [
        { text: '第二步，把觉察扩展到整个身体。' },
        { text: '感受整个身体，好像都在呼吸。', pause: 6 },
        { text: '留意身体的感觉：温度、重量，哪里紧，哪里松。', detail: 'standard', pause: 8 },
        { text: '没有明显的感觉，也没关系。', detail: 'standard' },
        { text: '不需要改变什么，只是感受。', pause: 6 },
        { text: '也留意姿势，还有脸上的表情。', detail: 'standard', pause: 8 },
        { text: '注意力被某个地方吸走了，就再放宽一些。', detail: 'detailed', pause: 6 },
      ],
      reminders: ['从头到脚，整个身体都在这里。'],
    },
  ],
  closing: [
    { text: '准备好时，抬起目光，看看四周。', detail: 'standard' },
    { text: '带着这份更宽的觉察，进入下一刻。' },
  ],
}

export const breathingSpaceCopingScript: GuidedScript = {
  id: 'breathing-space-coping',
  title: '呼吸空间 · 应对版',
  minMinutes: 3,
  maxMinutes: 5,
  opening: [
    { text: '这是呼吸空间练习，用在有点难的时候。' },
    { text: '不用急着让难受消失，先停一停。', minMinutes: 4 },
    { text: '坐着或站着都可以，双脚踩稳地面。' },
    // 文字引导怎么看：难受时睁着眼练，不提闭眼（见文件头）
    { text: '睁着眼睛，目光放低，落在屏幕上就好。' },
    { text: '感觉太强烈时，' },
    { text: '随时可以停下来，睁开眼睛看看四周。' },
  ],
  sections: [
    {
      id: 'aware',
      title: '觉察',
      weight: 1,
      minSilence: 2,
      intro: [
        { text: '第一步，问问自己：此刻，我正在经历什么？', pause: 4 },
        { text: '有什么念头？有什么情绪？', minMinutes: 5, pause: 4 },
        { text: '可以在心里给它起个名字，比如：这是担心。', pause: 4 },
        { text: '也可能是：这是难过，这是烦躁。', minMinutes: 5, pause: 4 },
        { text: '不用找最准确的词，大概就可以。', detail: 'detailed', minMinutes: 5, pause: 3 },

        { text: '这种感受在身体的哪里？', pause: 6 },
        { text: '胸口、喉咙、胃，还是肩膀？', minMinutes: 4, pause: 4 },
        { text: '找不到具体的位置，也没关系。', minMinutes: 4 },
        { text: '太强烈的话，只留意它的边缘，或者回到双脚。', pause: 3 },
        { text: '是什么样的感觉？发紧、发热、发沉，还是别的？', minMinutes: 4, pause: 6 },
        { text: '它的大小、温度，有没有在变化？', detail: 'detailed', minMinutes: 5, pause: 4 },
        { text: '不需要赶走它，允许它在这里。' },
      ],
    },
    {
      id: 'gather',
      title: '集中',
      weight: 1,
      minSilence: 6,
      intro: [
        { text: '第二步，把注意力收回到呼吸，或者双脚。' },
        { text: '感受腹部的起伏，或者脚底踩着地面的压力。' },
        { text: '不用吸得很深，让呼吸自己来去。', pause: 6 },
        { text: '被那个感受拉走了，' },
        { text: '发现了，就轻轻回到呼吸或双脚。' },
        { text: '发现自己被拉走，本身就是练习。' },
        { text: '需要回来多少次，就回来多少次。', minMinutes: 5, pause: 4 },
        { text: '脚底一直踩在地上，随时可以回到这里。', detail: 'detailed', minMinutes: 5, pause: 6 },
      ],
    },
    {
      id: 'expand',
      title: '扩展',
      weight: 1,
      minSilence: 9,
      intro: [
        { text: '第三步，把觉察扩展到整个身体。' },
        { text: '把刚才留意到的感受，也包括进来。' },
        { text: '和它一起呼吸，让它在这里。', pause: 6 },
        { text: '太强烈的话，就回到双脚。' },
        { text: '吸气时感受它，呼气时，让周围松一松。', minMinutes: 4, pause: 4 },
        { text: '不是要把难受赶走，只是不再跟它较劲。', minMinutes: 4, pause: 4 },
        { text: '感受整个身体，连同难受的部分，好像都在呼吸。', detail: 'detailed', minMinutes: 4 },
        { text: '也留意姿势，还有脸上的表情。', minMinutes: 5, pause: 6 },
      ],
    },
  ],
  closing: [
    { text: '接下来，怎样照顾自己是最合适的一步？', pause: 6 },
    { text: '选一件小事，' },
    { text: '比如喝口水、走一走，或者找信任的人聊聊。' },
    { text: '如果一直缓不过来，可以找专业的人帮忙。', minMinutes: 4 },
    { text: '准备好了，可以去做这一步。' },
  ],
}
