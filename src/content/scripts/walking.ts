/**
 * 正念行走（5 / 10 分钟）。原创中文引导词，只沿用公开的练习结构，不翻译、不改写任何现成录音。
 *
 * 结构依据：
 * - practice-santorelli-2017：MBSR 的慢走先给入门引导，再逐步减少；随时可以调整、休息或停下。
 * - practice-teut-2013：十分钟正念行走，边走边觉察身体感受，困难时改为关注呼吸。
 * - practice-deroche-2025：锚点不只是呼吸，也可以是双脚等；这里给脚底、呼吸、周围的声音三种。
 * - practice-kabatzinn-2018-zh：大陆通行译名「正念行走」。
 * - meditation-hasenkamp-2012：走神 → 发现 → 轻轻放下 → 回来；发现走神本身就是练习。
 * - meditation-lindsay-2018：每次练习都明确教接纳（不需要改变它、不评判）。
 * - practice-baer-2019：邀请而不是要求，给出调整和停下的办法。
 * - safety-nccih-2021-relaxation：焦虑加重、不想要的念头也是可以停下的理由，所以停下的提示里有「心里不舒服」。
 * - practice-uclamarc-2016、sound-knowlton-2006：人声占比按练习类型设定；越往后停顿越长。
 * 证据等级 D（meditation-prakhinkit-2014）：引导词里不提任何效果。
 *
 * 安全提示的内容和位置是设计判断（practice.notes §2.6、safety.notes §6），没有试验检验过。都是 core 句，任何档位都说：
 * - 开头三十秒内：平坦无障碍的路，户外避开车和人多处，靠墙走、可以扶，可以坐着练，头晕、累了或心里不舒服随时停下坐一会儿；
 *   全程睁眼也在开始站立之前说完。
 * - 开始慢走后几秒内：慢到觉得稳就好、手可以扶墙，坐着练怎么做。
 * - 自然步速：地方小就不必走快、转身前先停稳，户外注意行人和车，坐着练怎么做。
 * - 站定：坐着练怎么做，眼睛仍然睁着。只提腿上的感觉、声音和地面，不引导去注意心跳。
 *
 * 时间结构（practice.notes §2.6）：开头 → 站立（感受双脚承重；10 分钟加左右移动重心）→ 放慢脚步（抬起、移动、放下，转身）
 * → 脚底（感受、接纳、走神循环）→ 自然步速（只在 10 分钟：声音、看到的东西）→ 站定 → 结束。
 * 慢走拆成「放慢脚步」「脚底」两段：引擎只在段末分配弹性静默，拆开后慢走中途也有一段随档位伸缩的安静行走。
 * 10 分钟版在组与组之间另用空文字的行写明静默（只占时间，不朗读）。
 * 与模板的出入：开头的安全说明约四十五秒，开始走比模板晚约半分钟；5 分钟版组内提示相隔两到八秒，
 * 做不到模板的每三四十秒一条，因为 5 分钟详细档没有余量再加停顿。
 *
 * 人声占比（标准档；人声 = 朗读加句后的说话停顿，口径见 scripts.test.ts）：目标 5 分钟约 45%，10 分钟约 35%；
 * 按时间线估算约 56%、44%，开头的安全说明是必说的，5 分钟里它本身就占去一成多。标准档只留做法、换锚点、
 * 感觉很淡和不耐烦这几处；站姿、摇晃、站定后的感受和自然步速里的细节放在详细档，
 * 所以详细档比标准档多十五到二十个百分点，安静档少十到十五个。语音慢一成时一句也不少。
 */
import type { GuidedScript } from '@/content/types'

export const walkingScript: GuidedScript = {
  id: 'walking',
  title: '正念行走',
  minMinutes: 5,
  maxMinutes: 10,
  opening: [
    { text: '找一段平坦、没有障碍的路，能来回走五六步就行。' },
    { text: '在户外，避开车和人多的地方。' },
    { text: '最好靠墙走，需要时扶一下。' },
    { text: '担心站不稳，可以坐着练，轮流抬脚、放脚。' },
    { text: '头晕、累了或者心里不舒服，' },
    { text: '随时可以停下来，坐一会儿。' },
    { text: '这是正念行走。' },
    { text: '不赶路，只是知道自己在走。', detail: 'detailed' },
    { text: '全程睁着眼睛，目光落在前方几步远的地上。' },
  ],
  sections: [
    {
      id: 'stand',
      title: '站立',
      weight: 0.25,
      minSilence: 2,
      intro: [
        { text: '先站在这段路的一头，双脚分开，与肩同宽。' },
        { text: '膝盖微微放松，不用绷直。', detail: 'detailed', minMinutes: 10 },
        { text: '双手可以自然垂下，也可以在身前交握。', detail: 'detailed', minMinutes: 10 },
        { text: '留意双脚和地面接触的地方。', pause: 4 },
        { text: '身体的重量，顺着两条腿，落到脚底。', detail: 'detailed' },
        { text: '也许能感到脚底的压力，还有鞋袜的触感。', detail: 'detailed' },
        { text: '即使站着不动，身体也在做细小的调整。', detail: 'detailed', minMinutes: 10 },
        // 移重心要留出做的时间
        { text: '把重心慢慢移到左脚，再移到右脚。', detail: 'standard', minMinutes: 10, pause: 5 },
        { text: '感受重量怎样从一只脚，移到另一只脚。', detail: 'standard', minMinutes: 10, pause: 6 },
        { text: '然后回到中间，站稳。', detail: 'standard', minMinutes: 10 },
      ],
    },
    {
      id: 'slow',
      title: '放慢脚步',
      weight: 1.2,
      minSilence: 6,
      intro: [
        { text: '现在开始往前走，速度比平时慢很多。' },
        { text: '慢到自己觉得稳就好，手可以扶着墙。' },
        { text: '坐着练的话，就慢慢抬起一只脚，再放回地上。', pause: 6 },

        { text: '重心移到左脚，右脚抬起来。', detail: 'standard' },
        { text: '往前移一小步，脚跟先轻轻放下。', detail: 'standard' },
        { text: '走得这么慢，身体难免会有点摇晃。', detail: 'detailed' },
        { text: '一步一步走：抬起，移动，放下。', pause: 6 },
        { text: '愿意的话，可以在心里默念这三个词。', detail: 'detailed' },
        { text: '每次抬脚之前，也许能感到想要抬脚的那一刻。', detail: 'detailed', minMinutes: 10 },
        { text: '', detail: 'standard', minMinutes: 10, pause: 8 },

        { text: '每次走到尽头，先停一下，再小步慢慢转过身来。' },
        { text: '转身时，感受脚下重量的变化。', detail: 'standard', minMinutes: 10 },
      ],
      reminders: ['抬起，移动，放下。', '走到尽头，先停一下，再转身。'],
    },
    {
      id: 'soles',
      title: '脚底',
      weight: 1.8,
      minSilence: 8,
      intro: [
        { text: '感受脚底的压力，怎样从脚跟移到脚趾。', pause: 6 },
        { text: '抬起时，脚是轻的；放下时，重量又回到脚上。', detail: 'detailed', minMinutes: 10 },
        { text: '也许还能感到地面的软硬和温度。', detail: 'detailed', minMinutes: 10 },
        { text: '穿着鞋，感觉可能很淡，能感到多少是多少。', detail: 'standard' },
        { text: '如果很难留在脚上，', detail: 'standard' },
        { text: '也可以换成呼吸，或者周围的声音。', detail: 'standard', pause: 6 },
        { text: '', detail: 'standard', minMinutes: 10, pause: 8 },

        { text: '小腿和大腿的肌肉，在交替用力、放松。', detail: 'detailed', minMinutes: 10 },
        { text: '肩膀和手臂，是松的，还是紧的。', detail: 'detailed', minMinutes: 10, pause: 6 },
        { text: '放慢以后，可能会觉得不习惯，或者不耐烦。', detail: 'standard' },
        { text: '不管感觉到什么，都不需要改变它。', pause: 8 },
        { text: '', detail: 'standard', minMinutes: 10, pause: 6 },

        // 走神循环放在段末，后面紧接着这一段最长的安静行走
        { text: '走着走着，注意力跑到别处，这很自然。' },
        { text: '发现了，就轻轻放下刚才的念头，回到脚底。' },
        { text: '不用责怪自己，回来的这一下，就叫回神。', detail: 'detailed' },
        { text: '发现走神，本身就是练习。' },
      ],
      reminders: ['回到脚底。', '留意脚底的压力。'],
    },
    {
      id: 'natural',
      title: '自然步速',
      weight: 3.5,
      minSilence: 20,
      omitAtOrBelow: 5,
      intro: [
        { text: '现在，慢慢加快，回到平时走路的速度。' },
        { text: '地方小的话，不必走那么快，转身前先停稳。' },
        { text: '坐着练的话，就用平常的节奏，轮流抬脚、放脚。' },
        { text: '目光可以抬高一些，看向前方。', detail: 'standard' },
        { text: '在户外的话，注意路上的行人和车。' },
        { text: '手臂可以自然摆动。', detail: 'detailed' },
        { text: '脚步快了，也可以留意脚落地的感觉。', pause: 10 },

        { text: '戴着耳机的话，可以摘下一边。', detail: 'standard' },
        { text: '让注意力放宽一些，也听一听周围的声音。', pause: 6 },
        { text: '近处的，远处的，声音自己来，自己走。', detail: 'standard' },
        { text: '不用分辨是什么声音，也不评判好坏。', detail: 'standard', pause: 10 },

        { text: '也可以看看眼前的光线、颜色，还有动着的东西。', detail: 'standard', pause: 10 },
        { text: '不用一样一样去找，它们会自己出现。', detail: 'detailed' },
        { text: '脸上、手上碰到的空气，是凉还是暖。', detail: 'detailed', pause: 8 },

        { text: '被声音或画面带走了，就回到脚步。', detail: 'standard' },
      ],
      reminders: ['留意脚步，也听听周围。', '走神了，就回到脚步和声音。'],
    },
    {
      id: 'still',
      title: '站定',
      weight: 1.2,
      minSilence: 8,
      intro: [
        { text: '慢慢停下来，站定。' },
        { text: '坐着练的话，就让双脚平放在地上。' },
        { text: '再一次，回到双脚和地面的接触。', detail: 'detailed' },
        { text: '刚走完，腿上也许有些温热、发沉，', detail: 'detailed' },
        { text: '也可能没什么特别的。', detail: 'detailed' },
        { text: '呼吸是快是慢，都不用去调整它。', detail: 'detailed', minMinutes: 10, pause: 10 },
        { text: '听着周围的声音，感觉脚踩在地上。', detail: 'standard', minMinutes: 10, pause: 10 },
        { text: '眼睛仍然睁着，感受整个身体，从脚底到头顶。' },
        { text: '就这样安静一会儿，什么也不用做。', detail: 'detailed', minMinutes: 10 },
      ],
    },
  ],
  closing: [
    { text: '这次正念行走，就到这里。' },
    { text: '之后走路的时候，也可以留意一下脚底。' },
    { text: '比如去接水，或者去洗手间的路上。', detail: 'detailed', minMinutes: 10 },
  ],
}
