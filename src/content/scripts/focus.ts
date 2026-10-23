/**
 * 专注呼吸（5 / 10 / 15 / 20 / 30 分钟）。原创中文引导词，只沿用公开的练习结构，不翻译、不改写任何现成录音。
 *
 * 结构（practice.notes §2.3）：到达 → 找到呼吸（不需要控制呼吸），接着教走神与回神、回神键
 * → 跟随呼吸（提醒先密后疏；二十分钟起先说明后面不再提醒，再留一段完整的静默）→ 整个身体 → 收尾。
 * 找锚点和教循环是一段连续的讲解，放在同一段里，中间不响段落提示音。
 *
 * 依据：
 * - practice-hasenkamp-2012、meditation-hasenkamp-2012：走神 → 发现 → 转回 → 保持；发现走神时按键，正是这个研究的做法。
 *   脚本里写成「走神，发现，放下，回来」，并说明点得多不等于练得差。
 * - meditation-lindsay-2018：每次都明确教接纳（允许、不评判、不需要改变它）。
 * - practice-santorelli-2017：引导随时长减少、静默加长；随时可以调整或停下。
 * - practice-uclamarc-2016：锚点可以是腹部、胸口或鼻孔；可以在心里标记「想」「走神」（只在详细档，十分钟起）。
 * - practice-deroche-2025（引 Treleaven 2018）、practice-baer-2019：锚点也可以是双脚、双手；邀请而不是要求。
 *   声音作为锚点、可以睁眼见 practice.notes §1。
 * - meditation-killingsworth-2010：走神是常态，所以在它发生的地方讲，不当成失败。
 * - safety-britton-2021、safety-nccih-2021-relaxation：开头三十秒内说清不舒服时怎么办；二十分钟起补上不真实感
 *   和应对办法（safety.notes §5），讲到情绪时给出退路，进入长静默之前再说一次随时可以停。
 * - sound-knowlton-2006：越往后停顿越长，后段基本不说话。
 * - sound-bernardi-2006：二十分钟起，结尾的话说完再安静二十秒左右才响结束钟声（sound.notes §2.5）。
 *
 * 人声占比目标（标准档；人声 = 朗读加句后的说话停顿，口径见 scripts.test.ts）：5、10、20 分钟取自
 * practice.notes §2.3（约 50%、40%、25%）；15、30 分钟按内插和外推取 32%、18%。
 *
 * 写法：
 * - 不用 reminders：引擎把提醒尽量排满、循环使用，做不到「先密后疏」，也分不了档位。
 *   提醒写成「跟随呼吸」段的引导句，句间的静默用空文字的行写明（只占时间，不朗读）。
 * - 每组提醒前的静默按时长用 minMinutes 加长；详细档多出的句子插在静默中间，不改变标准档的节奏。
 *   每组的第一句多为 core，安静档在长练习里也有稀疏的提醒。
 * - 弹性静默大部分给「跟随呼吸」，成为练习末尾那段完整的静默；「整个身体」至少留二十秒，
 *   时间宽裕时再按权重 0.2 多分一些，收尾之前有一段什么也不做的安静。
 *   静默下限尽量放在「整个身体」：下限在语速调慢时可以等比压缩，写明的停顿不行；
 *   这样详细档五分钟、十分钟练习末尾那段静默也只有半分钟左右（practice.notes §1 三档表）。
 * - 写明的静默不随语速压缩，语速调慢时先缩短的是弹性静默；语音慢一成时一句也不少（scripts.test.ts）。
 * - v1 是文字引导（PRODUCT.md §0、§5）：每句的时长就是读完这一句再停一会儿的时间。开头说一次怎么看：
 *   目光落在屏幕上，安静时可以闭眼，听到轻响再看屏幕。只有听才成立的说法改成读的说法
 *   （「我会少说一些」改为「提示会少一些」，「说到呼吸」改为「提到呼吸」）；听周围的声音照旧。
 */
import type { GuidedScript } from '@/content/types'

export const focusScript: GuidedScript = {
  id: 'focus',
  title: '专注呼吸',
  minMinutes: 5,
  maxMinutes: 30,
  opening: [
    { text: '这是一段专注呼吸的练习。' },
    { text: '找一个舒服、稳定的姿势，坐着、躺着都可以。' },
    // 文字引导怎么看：开头说一次，任何档位都说。专注呼吸每个时长都有二十秒以上的安静，所以把轻响也说上
    { text: '目光放低，落在屏幕上就好。' },
    { text: '安静的时候，可以闭上眼睛，' },
    { text: '听到一声轻响，再看屏幕。' },
    // 安全提示：开头约二十秒说出，任何档位都说
    { text: '练习中如果觉得紧张、不舒服，' },
    { text: '可以睁开眼睛，看看四周，' },
    { text: '或者感受双脚的重量。' },
    { text: '任何时候，都可以调整姿势，或者停下来。' },
    // 二十分钟起：不真实感（safety.notes §5 静坐）
    { text: '安静久了，有人会觉得自己或周围不太真实。', minMinutes: 20 },
    { text: '这时可以睁开眼睛，摸一摸身边的东西。', minMinutes: 20 },
    { text: '如果这种感觉一直不退，今天就先练到这里。', minMinutes: 20 },

    { text: '坐着的话，后背挺直，但不僵硬。', detail: 'detailed' },
    { text: '坐在椅子上，双脚可以平放在地上。', detail: 'detailed', minMinutes: 20 },
    { text: '先花一点时间，让身体安顿下来。', detail: 'standard', minMinutes: 15, pause: 6 },
    { text: '', pause: 4, minMinutes: 20 },
    { text: '感受身体的重量，压在椅子、垫子或床上。', detail: 'standard', pause: 3 },
    { text: '留意接触的感觉，是硬是软，是凉是暖。', detail: 'standard', minMinutes: 10, pause: 3 },
    { text: '肩膀或者下巴要是有点紧，可以试着松一点。', detail: 'standard', minMinutes: 15 },
    { text: '松不开，就让它这样。', detail: 'standard', minMinutes: 15 },
    { text: '也听一听周围的声音，近的，远的。', detail: 'standard', minMinutes: 15, pause: 4 },
    { text: '然后留意此刻的心情，不需要改变它。', detail: 'standard', minMinutes: 20, pause: 4 },
    { text: '这段练习不求放松，', detail: 'standard', minMinutes: 10 },
    { text: '有没有特别的感受，都可以。', detail: 'standard', minMinutes: 10, pause: 2 },
  ],
  sections: [
    {
      id: 'anchor',
      title: '找到呼吸',
      weight: 0,
      minSilence: 2,
      intro: [
        { text: '现在，把注意力带到呼吸上。' },
        { text: '找一找，身体哪里最容易感觉到呼吸。' },
        { text: '可能是腹部或胸口的起伏，', detail: 'standard' },
        { text: '也可能是鼻孔边，吸气时的凉意。', detail: 'standard', pause: 2.5 },
        { text: '一时找不到，可以把手放在腹部，', detail: 'detailed', minMinutes: 10 },
        { text: '感受手跟着呼吸，轻轻起落。', detail: 'detailed', minMinutes: 10, pause: 3 },
        { text: '不需要控制呼吸，身体自己会呼吸。', pause: 2 },
        { text: '呼吸长短都可以，一留意就变了，也没关系。', detail: 'standard', minMinutes: 10, pause: 2 },
        { text: '如果留意呼吸让你紧张，' },
        { text: '也可以把注意力放在双脚、双手，或者声音上。' },
        { text: '后面提到呼吸，就换成你选的地方。', pause: 2 },
        { text: '选好了，就停在那里，不用来回换。', detail: 'standard', minMinutes: 10 },
        { text: '感觉不明显的话，', detail: 'standard' },
        { text: '知道自己在吸气、在呼气，就够了。', detail: 'standard', pause: 3 },
        { text: '跟着一次吸气，从开始到结束。', detail: 'standard', minMinutes: 10, pause: 3 },
        { text: '再跟着一次呼气，从开始到结束。', detail: 'standard', minMinutes: 10, pause: 4 },
        { text: '吸气和呼气之间，可能有一个很短的停顿。', detail: 'standard', minMinutes: 15, pause: 4 },
        { text: '每一次呼吸，都有一点不一样。', detail: 'standard', minMinutes: 15, pause: 5 },
        { text: '', pause: 6, minMinutes: 20 },
        { text: '', pause: 3 },

        // 走神与回神
        { text: '这个练习，不是要让头脑一片空白。', detail: 'standard', minMinutes: 10 },
        { text: '心会走神，这很自然。' },
        { text: '可能想起一件事，或者开始计划什么。', detail: 'standard', minMinutes: 10 },
        { text: '刚开始练，几秒钟就走神一次，也很常见。', detail: 'detailed', minMinutes: 10 },
        { text: '有时候跑开很久才发现，这也是常有的事。', detail: 'standard', minMinutes: 15 },
        { text: '发现走神，本身就是练习。', pause: 2.5 },
        { text: '不需要评判自己。' },
        { text: '有什么念头和感觉，都允许它们在。', pause: 2.5 },
        { text: '然后轻轻放下，回到呼吸，' },
        { text: '这就是一次回神。', pause: 3 },
        { text: '走神，发现，放下，回来。', detail: 'standard', minMinutes: 10, pause: 2.5 },
        { text: '专注呼吸，练的就是这个来回。', detail: 'standard', minMinutes: 10, pause: 2 },
        // 回神键：只在这里教一次
        { text: '注意到心跑开的时候，' },
        { text: '可以轻点一下屏幕，或者按空格键，' },
        { text: '看看心刚才去了哪里，', detail: 'standard', minMinutes: 10 },
        { text: '再回到呼吸。' },
        { text: '点得多，不代表练得不好。' },
        { text: '点不点都可以。', detail: 'standard', minMinutes: 10, pause: 2 },
      ],
    },
    {
      id: 'practice',
      title: '跟随呼吸',
      weight: 1,
      minSilence: 2,
      // 每组：静默 →（详细档的句子）→ 静默 → 按时长加长的静默 → 一组提醒。
      // 标准档各组之前写明的静默（秒）：
      //   5 分钟  20、22
      //   10 分钟 20、22、39、41、45
      //   15 分钟 28、32、55、57、61、64、68
      //   20 分钟 36、40、59、65、71、78、86、94，再隔 15 秒说明后面不再提醒
      //   30 分钟 40、45、69、75、83、90、96、104、106、114、122、130，再隔 15 秒说明后面不再提醒
      // 最后是弹性静默（按段落权重分到的时间）。详细档的句子都插在这些静默中间，
      // 语速调慢时只有弹性静默会缩短。
      intro: [
        { text: '接下来，提示会少一些。' },
        { text: '你继续跟着呼吸就好。' },

        { text: '', pause: 10 },
        { text: '吸气的时候，知道在吸气。', detail: 'detailed' },
        { text: '呼气的时候，知道在呼气。', detail: 'detailed' },
        { text: '', pause: 10 },
        { text: '', pause: 8, minMinutes: 15 },
        { text: '', pause: 8, minMinutes: 20 },
        { text: '', pause: 4, minMinutes: 30 },
        { text: '注意力在哪里？' },
        { text: '跑开了，就回来，', detail: 'standard' },
        { text: '回到这一次呼吸。', detail: 'standard' },

        { text: '', pause: 11 },
        { text: '发现自己在想事情，可以在心里说一声「想」。', detail: 'detailed', minMinutes: 10 },
        { text: '然后回到呼吸。', detail: 'detailed', minMinutes: 10 },
        { text: '', pause: 11 },
        { text: '', pause: 10, minMinutes: 15 },
        { text: '', pause: 8, minMinutes: 20 },
        { text: '', pause: 5, minMinutes: 30 },
        // 一句善待自己的话（practice.notes §2.3 十分钟模板）
        { text: '走神多少次都没关系，', detail: 'standard' },
        { text: '回来的时候，对自己温柔一点。', detail: 'standard' },

        { text: '', pause: 20, minMinutes: 10 },
        { text: '感受空气进来，又出去。', detail: 'detailed', minMinutes: 10 },
        { text: '', pause: 19, minMinutes: 10 },
        { text: '', pause: 16, minMinutes: 15 },
        { text: '', pause: 4, minMinutes: 20 },
        { text: '', pause: 10, minMinutes: 30 },
        { text: '心走远了，就从下一次吸气重新开始。', minMinutes: 10 },
        { text: '刚才想到的事，先放一放。', detail: 'standard', minMinutes: 10 },

        { text: '', pause: 21, minMinutes: 10 },
        { text: '心跑开了，也可以在心里说一声「走神」。', detail: 'detailed', minMinutes: 10 },
        { text: '再回来。', detail: 'detailed', minMinutes: 10 },
        { text: '', pause: 20, minMinutes: 10 },
        { text: '', pause: 16, minMinutes: 15 },
        { text: '', pause: 8, minMinutes: 20 },
        { text: '', pause: 10, minMinutes: 30 },
        { text: '身体哪里不舒服，先看看是什么感觉。', detail: 'standard', minMinutes: 10 },
        { text: '想动一动，就慢慢动，知道自己在动。', detail: 'standard', minMinutes: 10 },

        { text: '', pause: 23, minMinutes: 10 },
        { text: '下一次呼气，跟着它，直到结束。', detail: 'detailed', minMinutes: 10 },
        { text: '', pause: 22, minMinutes: 10 },
        { text: '', pause: 16, minMinutes: 15 },
        { text: '', pause: 10, minMinutes: 20 },
        { text: '', pause: 12, minMinutes: 30 },
        { text: '有点困也很常见，可以睁着眼睛练。', minMinutes: 10 },
        { text: '也可以坐直一些，或者从躺着改成坐着。', detail: 'standard', minMinutes: 10 },

        { text: '', pause: 32, minMinutes: 15 },
        { text: '留意鼻孔时，吸气可能凉一点，呼气暖一点。', detail: 'detailed', minMinutes: 20 },
        { text: '', pause: 32, minMinutes: 15 },
        { text: '', pause: 14, minMinutes: 20 },
        { text: '', pause: 12, minMinutes: 30 },
        { text: '如果总是很难回来，', detail: 'standard', minMinutes: 15 },
        { text: '可以在心里跟着说：吸，呼。', detail: 'standard', minMinutes: 15 },

        { text: '', pause: 34, minMinutes: 15 },
        { text: '念头来来去去，由它去，', detail: 'detailed', minMinutes: 15 },
        { text: '注意力留在呼吸上。', detail: 'detailed', minMinutes: 15 },
        { text: '', pause: 34, minMinutes: 15 },
        { text: '', pause: 18, minMinutes: 20 },
        { text: '', pause: 10, minMinutes: 30 },
        { text: '听到声音，知道是声音就好。', minMinutes: 15 },
        { text: '不用顺着它想下去，', detail: 'standard', minMinutes: 15 },
        { text: '再回到你选的那个地方。', detail: 'standard', minMinutes: 15 },

        { text: '', pause: 47, minMinutes: 20 },
        { text: '吸气是长是短，知道就好。', detail: 'detailed', minMinutes: 20 },
        { text: '', pause: 47, minMinutes: 20 },
        { text: '', pause: 10, minMinutes: 30 },
        // 情绪：先承认，再回来；太强烈时换到双脚（practice.notes §1 的退路）
        { text: '有情绪冒出来，知道它在就好。', minMinutes: 20 },
        { text: '不用推开，再回到呼吸。', detail: 'standard', minMinutes: 20 },
        { text: '太强烈时，可以把注意力放到双脚上。', minMinutes: 20 },

        { text: '', pause: 53, minMinutes: 30 },
        { text: '累了，可以睁眼歇一会儿，再接着练。', detail: 'detailed', minMinutes: 30 },
        { text: '', pause: 53, minMinutes: 30 },
        { text: '这一次呼吸，和上一次有什么不同？', minMinutes: 30 },

        { text: '', pause: 57, minMinutes: 30 },
        { text: '在你选的地方，有没有细小的变化？', detail: 'detailed', minMinutes: 30 },
        { text: '', pause: 57, minMinutes: 30 },
        { text: '念头越多，回来的机会也越多。', minMinutes: 30 },

        { text: '', pause: 61, minMinutes: 30 },
        { text: '心很乱，可以只留意呼气。', detail: 'detailed', minMinutes: 30 },
        { text: '', pause: 61, minMinutes: 30 },
        { text: '留意呼气怎样结束，下一次吸气怎样开始。', detail: 'standard', minMinutes: 30 },
        { text: '呼吸不需要变得更好，现在这样就可以。', detail: 'standard', minMinutes: 30 },

        { text: '', pause: 65, minMinutes: 30 },
        { text: '觉得烦躁或者无聊，也只是看着它。', detail: 'detailed', minMinutes: 30 },
        { text: '', pause: 65, minMinutes: 30 },
        { text: '不管心去了哪里，都可以回到你选的地方。', minMinutes: 30 },

        // 二十分钟起：说明后面是一段完整的静默，再说一次随时可以停
        { text: '', pause: 15, minMinutes: 20 },
        { text: '后面几分钟，不再有新的提示，', minMinutes: 20 },
        { text: '你按自己的节奏练习。', minMinutes: 20 },
        { text: '有需要，随时可以睁开眼睛，或者停下来。', minMinutes: 20 },
      ],
    },
    {
      id: 'widen',
      title: '整个身体',
      weight: 0.2,
      // 收尾之前至少二十秒什么也不做的安静（sound.notes §2.5）
      minSilence: 20,
      intro: [
        { text: '现在，慢慢把注意力放宽，' },
        { text: '感受整个身体在呼吸。', pause: 3 },
        { text: '从头到脚，哪里有感觉，就留意哪里。', detail: 'detailed', minMinutes: 20, pause: 3 },
        { text: '还有身体的重量，皮肤上的温度。', detail: 'standard', minMinutes: 10, pause: 3 },
        { text: '再听一听周围的声音。', detail: 'standard', minMinutes: 10, pause: 3 },
        { text: '刚才的每一次发现和回来，', detail: 'standard', minMinutes: 10 },
        { text: '都是练习本身。', detail: 'standard', minMinutes: 10, pause: 3 },
        { text: '就这样再待一会儿，什么也不做。', detail: 'standard', minMinutes: 15, pause: 8 },
      ],
    },
  ],
  closing: [
    { text: '练完以后，偶尔想起来，也可以这样回来一下。', detail: 'standard', pause: 2.5 },
    { text: '听到钟声，可以慢慢睁开眼睛，或者抬起目光，' },
    { text: '动一动手和脚。' },
    // 二十分钟起：说完再安静一会儿，才响结束钟声
    { text: '', pause: 10, minMinutes: 20 },
  ],
}
