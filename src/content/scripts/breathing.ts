/**
 * 跟随节拍的三种呼吸：慢呼吸、周期性叹息、箱式呼吸。原创中文引导词，只沿用公开的练习结构。
 * 节拍由画面、提示音和振动来带，人声只是很薄的一层：开头不超过二十五秒的说明，中段一次查看
 * （慢呼吸十分钟起两次），最后三十秒左右一句「回到自然呼吸」。水中、驾驶的警示写在详情页，不朗读。
 *
 * 结构依据：
 * - practice.notes §2.8（practice-lehrer-2018、breathing-shaffer-2020）：开头讲姿势，中段查看，最后回到自然呼吸。
 *   模板的人声占比为 5 分钟 12%、10 分钟 10%、20 分钟 6%。这里标准档约为 13%、8%、4%，长时长偏低：
 *   节拍和提示音承担了引导，中段只在有具体内容时才开口（实测见 scripts.test.ts）。
 * - breathing-szulczewski-2019、safety-szulczewski-2019：开头说「轻柔地呼吸，不必吸得很深」（叹息的说法见下），
 *   练习中再提醒一次。慢呼吸的中段查看因此任何档位都说；叹息和箱式呼吸的查看讲的是吃力和停顿，仍在标准档。
 *   不说「深吸一口气」。breathing-fincham-2023-rct：两组都用鼻子、腹部、轻柔地呼吸；
 *   breathing-meuret-2008：慢而轻，不求深。
 * - breathing-steffen-2021：没练过的人跟不上每分钟六次，所以节拍先快后慢；跟丢了很常见，从下一次吸气接上。
 * - breathing-bscn-2013、safety-peltola-2023：头晕、手指或嘴唇发麻是呼吸过度的信号。停下的办法在开头半分钟内说完：
 *   先不跟节拍，自然地呼吸（breathing.notes §6「请停止跟随节拍」）。不说「停下来」，免得和箱式呼吸的「停」混淆；
 *   「或者不舒服」「随时」是不附条件的许可（practice.notes §1；safety.notes §6 的停止指引也包括强烈的恐慌）。
 * - breathing-balban-2023-protocol：叹息是鼻吸、补吸一小口、用嘴慢慢呼完，研究里自己掌握快慢，
 *   详细档只说可以放慢（加快会让通气量上去）。箱式呼吸「吃力就缩短」；节拍固定时能做的是停得短一些，或者不停。
 * - 与 PRODUCT §10 的出入：叹息本来就要吸得比平时满，不说「不必吸得很深」，改为「轻轻吸到七八成满，再补一小口」。
 *   safety.notes §2 规定不提示吸到最满，节拍的第一口也只到七八成（SIGH_IN_LEVEL）。这一处需要产品确认。
 * - breathing-riedl-2026：一分钟的叹息只作当下的缓一缓（「现在有点难」），一分钟版不加中段的话。
 * - breathing-zelano-2016：默认用鼻子，鼻子不通可以用嘴，仍然轻轻地呼吸。
 * - breathing-laborde-2022-hrvb，以及 Szulczewski 2019 的七天数据（breathing.notes §5）：头几次觉得气不够、
 *   不太舒服很常见。详细档在节拍放慢以后说，并配上「不用把每一口吸大」，与四周呼吸第一周的提示一致。
 * - breathing-bentley-2023：练习中少打断；sound-knowlton-2006：越往后越少说话。
 *
 * 写法：
 * - 引擎按钟点排句子，不按呼吸的相位，所以讲做法的句子写成「吸气用鼻子……」「每一轮先用鼻子……」这样的说明，
 *   在哪个相位听到都说得通，不用「现在吸气」一类的口令。
 * - 不分段，免得段落提示音混进节拍里。中段的话用空文字的行推到想要的时刻（只占时间，不朗读）；
 *   空行和它推动的那句话同一档位。详细档多出的句子插在空行之间，后面的话因此晚十几到二十几秒；
 *   安静档开头少一句，慢呼吸的查看早四秒。
 * - 结尾那句先说完，再留约二十秒安静的自然呼吸，然后是结束钟声。这句话预设节拍此时已经停下（引擎待办）；
 *   说的是「不用再跟着」，节拍还在走也说得通。
 * - v1 是文字引导（PRODUCT.md §0、§5）：这几句显示在节拍画面上，人本来就看着屏幕跟节拍。
 *   详细档说可以闭眼跟着节拍声练时，补一句隔一会儿看一眼屏幕，中段的提醒（包括「放轻一些」）才不会错过。
 */
import type { GuidedScript } from '@/content/types'

/** 结尾那句说完以后留的安静：标准档里那句从结束前约三十秒开始 */
const NATURAL_TAIL_SEC = 13

/**
 * 慢呼吸：3 / 5 / 10 / 15 / 20 分钟。
 * 标准档的查看约在 1:34、2:29、3:29、5:04、6:44（任何档位都说）；十分钟起约在 6:31、9:56、13:16 再说一次。
 */
export const slowScript: GuidedScript = {
  id: 'slow',
  title: '慢呼吸',
  minMinutes: 3,
  maxMinutes: 20,
  opening: [
    { text: '这是慢呼吸，坐着、躺着都可以。', pause: 0.5 },
    // 安全提示（PRODUCT §10）：开头十秒内，任何档位都说
    { text: '轻柔地呼吸，不必吸得很深。', pause: 0.5 },
    // 默认节拍下，这句正好落在开头放慢的第二次吸气里
    { text: '吸气用鼻子，让腹部自然起伏。', pause: 0.5 },
    { text: '节拍开头稍快，会一点点慢下来。', detail: 'standard', pause: 0.5 },
    // 安全提示：呼吸过度的信号，以及随时可以先不跟节拍
    { text: '如果头晕，手指、嘴唇发麻，或者不舒服，', pause: 0.4 },
    { text: '随时可以先不跟节拍，自然地呼吸。' },

    { text: '', pause: 8 },
    { text: '听得到节拍的话，也可以闭上眼睛，', detail: 'detailed' },
    { text: '隔一会儿，看一眼屏幕上的提示。', detail: 'detailed' },
    { text: '鼻子不通的话，也可以用嘴，轻轻地呼吸。', detail: 'detailed', minMinutes: 5 },
    // 默认速度下，节拍约在一分半时放慢到位，气不够的感觉多从这时开始
    { text: '', pause: 50 },
    { text: '觉得气不够很常见，不用把每一口吸大。', detail: 'detailed' },
    { text: '一直这样，可以点「有点急」按钮，节拍会快一点。', detail: 'detailed' },
    // 中段查看：练习中再提醒一次放轻（safety-szulczewski-2019），任何档位都说
    { text: '', pause: 10 },
    { text: '', pause: 55, minMinutes: 5 },
    { text: '', pause: 60, minMinutes: 10 },
    { text: '', pause: 95, minMinutes: 15 },
    { text: '', pause: 100, minMinutes: 20 },
    { text: '留意一下呼吸，如果有点用力，就放轻一些。' },
    { text: '跟丢了也没关系，从下一次吸气接上就好。', detail: 'detailed', minMinutes: 5 },
    // 十分钟起，约三分之二处再说一次：长时间跟节拍，呼吸容易越来越深
    { text: '', pause: 175, detail: 'standard', minMinutes: 10 },
    { text: '', pause: 110, detail: 'standard', minMinutes: 15 },
    { text: '', pause: 100, detail: 'standard', minMinutes: 20 },
    { text: '吸气还是轻轻的，不用越吸越深。', detail: 'standard', minMinutes: 10, pause: 0.8 },
    { text: '走神很自然，发现了，再跟上节拍就好。', detail: 'standard', minMinutes: 10 },
  ],
  sections: [],
  closing: [
    { text: '最后这一会儿，不用再跟着节拍，自然地呼吸就好。' },
    { text: '留意一下现在的呼吸，不需要改变它。', detail: 'detailed' },
    { text: '', pause: NATURAL_TAIL_SEC },
  ],
}

/**
 * 周期性叹息：1 / 3 / 5 分钟。一分钟版来自「现在有点难」，只说做法、安全提示和结尾一句；
 * 三分钟起加中段查看（约 1:29、2:29）。吸气只到七八成满再补一小口，任何时长、任何档位都说。
 */
export const cyclicSighScript: GuidedScript = {
  id: 'cyclic-sigh',
  title: '周期性叹息',
  minMinutes: 1,
  maxMinutes: 5,
  opening: [
    { text: '周期性叹息，可以坐着，也可以躺着。', pause: 0.5 },
    // 安全提示：不提示吸到最满（safety.notes §2）。「每一轮」开头，听起来是在讲做法，不是当下的口令
    { text: '每一轮先用鼻子，轻轻吸到七八成满，', pause: 0.4 },
    { text: '再补一小口，然后用嘴慢慢呼完，不用往外挤。', pause: 0.5 },
    // 安全提示：呼吸过度的信号，以及随时可以先不跟节拍
    { text: '如果头晕，手指、嘴唇发麻，或者不舒服，', pause: 0.4 },
    { text: '随时可以先不跟节拍，自然地呼吸。' },

    { text: '', pause: 8, detail: 'standard', minMinutes: 3 },
    { text: '节拍只是参考，也可以多等一会儿再吸。', detail: 'detailed', minMinutes: 3 },
    { text: '鼻子不通的话，吸气也可以用嘴。', detail: 'detailed', minMinutes: 3 },
    // 中段查看
    { text: '', pause: 56, detail: 'standard', minMinutes: 3 },
    { text: '', pause: 60, detail: 'standard', minMinutes: 5 },
    { text: '吃力的话，两轮之间可以歇一两口气，再接上。', detail: 'standard', minMinutes: 3 },
  ],
  sections: [],
  closing: [
    { text: '最后这一会儿，不用再跟着节拍，自然地呼吸就好。' },
    { text: '留意一下现在的呼吸，不需要改变它。', detail: 'detailed', minMinutes: 3 },
    { text: '', pause: NATURAL_TAIL_SEC, minMinutes: 3 },
  ],
}

/** 箱式呼吸：3 / 5 分钟。标准档的查看约在 1:31、2:31 */
export const boxScript: GuidedScript = {
  id: 'box',
  title: '箱式呼吸',
  minMinutes: 3,
  maxMinutes: 5,
  opening: [
    { text: '箱式呼吸，坐着或者躺着练都可以。', pause: 0.5 },
    // 安全提示（PRODUCT §10）：开头十秒内，任何档位都说
    { text: '轻柔地呼吸，不必吸得很深。', pause: 0.5 },
    { text: '停顿时，喉咙放松，不用憋劲。', pause: 0.5 },
    // 停顿最容易让人发慌：可以缩短，也可以不停
    { text: '吃力就停得短一些，也可以不停。', pause: 0.5 },
    // 安全提示：说「先不跟节拍」，不说「停下来」，免得和停顿的「停」混淆
    { text: '如果头晕、心慌、胸口发紧，或者不舒服，', pause: 0.4 },
    { text: '随时可以先不跟节拍，自然地呼吸。' },

    { text: '', pause: 8, detail: 'standard' },
    { text: '吸气、停、呼气、停，每一步一样长。', detail: 'detailed' },
    { text: '听得到节拍的话，也可以闭上眼睛，', detail: 'detailed' },
    { text: '隔一会儿，看一眼屏幕上的提示。', detail: 'detailed' },
    { text: '鼻子不通的话，也可以用嘴，轻轻地呼吸。', detail: 'detailed', minMinutes: 5 },
    // 中段查看
    { text: '', pause: 57, detail: 'standard' },
    { text: '', pause: 60, detail: 'standard', minMinutes: 5 },
    { text: '停顿的时候，留意喉咙和肩膀是不是放松的。', detail: 'standard' },
    { text: '如果一直吃力，下次可以把每一步缩短。', detail: 'detailed' },
    { text: '走神或跟丢了，从下一次吸气接上就好。', detail: 'detailed', minMinutes: 5 },
  ],
  sections: [],
  closing: [
    { text: '最后这一会儿，不用再跟着节拍，自然地呼吸就好。' },
    { text: '留意一下现在的呼吸，不需要改变它。', detail: 'detailed' },
    { text: '', pause: NATURAL_TAIL_SEC },
  ],
}
