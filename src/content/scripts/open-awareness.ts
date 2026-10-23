/**
 * 开放觉察（5 / 10 / 20 分钟）。原创中文引导词，只沿用公开的练习结构，不翻译、不改写任何现成录音。
 *
 * 结构依据：
 * - practice-santorelli-2017：MBSR 第五课的静坐顺序：呼吸 → 身体 → 声音 → 把想法和情绪当作心里的事件 →
 *   无拣择觉察 → 回到呼吸；静默越往后越长；先探索感觉，太强烈时再换锚点。
 * - meditation-lutz-2008：开放觉察是不加反应地觉察每一刻经验的内容，区别于专注于一个对象。
 * - meditation-hasenkamp-2012：走神 → 发现 → 轻轻放下 → 回来；发现走神本身就是练习。
 * - meditation-lindsay-2018：每段都明确教接纳（允许、不评判、不需要改变它）。
 * - practice-baer-2019、practice-deroche-2025：邀请的语气；呼吸之外可以用双脚或声音作锚点；随时可以调整或停下。
 * - safety-britton-2021：开头说明时间感可能变化、可能觉得自己或周围不真实，以及这种感觉持续时怎么办；
 *   先换向外的锚点（睁眼、听声音），再换专注呼吸，和停止指引里的落地做法一致。
 * - practice-uclamarc-2016、sound-knowlton-2006：人声占比按练习类型设定；停顿随练习推进逐渐变长。
 *
 * 写法：
 * - 时间结构按 practice.notes §2.4；5 分钟省略「身体」和「无拣择觉察」两段。
 * - 退路放在「转向感觉」之后。每段最后一句都是这一段练习本身的指引，不是退路，任何档位和时长都一样，
 *   因为听的人会带着最后一句进入这一段的静默。
 * - 停顿写在对应的指引后面。只在 20 分钟才说的句子停顿偏短，语速慢一些时结尾的话仍然说得完。
 * - 人声占比目标（标准档；人声 = 朗读加句后的说话停顿，口径见 scripts.test.ts）：5 分钟约 55%，10 分钟约 40%，
 *   20 分钟约 28%；按时间线估算约 64%、50%、36%，安全提示和走神循环是必说的。坐姿、举例和「没什么声音时」
 *   这类细节放在详细档，所以详细档比标准档多十到二十个百分点；安静档比标准档少十五到二十个百分点。
 * - 段中的提醒都写成带停顿的引导语，按档位和时长筛选，不用 reminders。
 * - 无拣择觉察没有固定对象，最容易让人不安，所以标为可跳过（skippable），跳过就直接回到呼吸。
 * - v1 是文字引导（PRODUCT.md §0、§5）。开头说一次怎么看：目光落在屏幕上；闭眼和轻响从 10 分钟起说，
 *   5 分钟的详细档没有二十秒以上的安静。「字幕」只用来比喻想法：原来的「接着看字幕」在屏幕上读来像是说引导的字，
 *   改为「继续看着想法」；「等下一句出现」改为「等它自己出现」。犯困时的出口改为「睁着眼睛」，结尾改为「抬起目光」。
 */
import type { GuidedScript } from '@/content/types'

export const openAwarenessScript: GuidedScript = {
  id: 'open-awareness',
  title: '开放觉察',
  minMinutes: 5,
  maxMinutes: 20,
  opening: [
    { text: '开放觉察练习，先从一个舒服、稳定的坐姿开始。', pause: 2.5 },
    // 文字引导怎么看：任何档位都说；闭眼和轻响从 10 分钟起说（见文件头）
    { text: '目光垂下，落在屏幕上。', pause: 2.5 },
    { text: '安静的时候可以闭眼，听到轻响再看屏幕。', minMinutes: 10 },
    // 安全提示：开头约二十秒说出，任何档位都说
    { text: '静坐时，对时间的感觉可能会变，' },
    { text: '有时也会觉得自己或周围不太真实。' },
    { text: '如果这种感觉一直不消失，' },
    { text: '就睁开眼睛，换成听声音或者专注呼吸，' },
    { text: '也可以早点结束。' },
    { text: '任何时候，都可以调整姿势，或者停下来。' },
    { text: '后背自然挺直，肩膀放松。', detail: 'detailed' },
    { text: '从呼吸开始，觉察的范围会一步一步放宽。', detail: 'detailed', minMinutes: 10 },
    { text: '不需要让自己平静下来，', detail: 'detailed' },
    { text: '只是看看现在有什么。', detail: 'detailed' },
  ],
  sections: [
    {
      id: 'breath',
      title: '呼吸',
      weight: 0.6,
      minSilence: 2,
      intro: [
        { text: '把注意力放到呼吸上。' },
        { text: '鼻孔、胸口或者腹部，哪里最清楚，就留意哪里。', detail: 'standard' },
        { text: '不需要控制呼吸，让它自己进出。', pause: 5 },
        { text: '也可以把一只手放在腹部，感受它的起伏。', detail: 'detailed' },
        { text: '如果留意呼吸让你紧张，就换成感受双脚。', detail: 'standard', pause: 3 },
        { text: '从吸气开始，一直跟到呼气结束。', detail: 'standard', minMinutes: 20, pause: 5 },
        { text: '心会走神，这很自然。' },
        { text: '发现走神的那一刻，就是回神，' },
        { text: '这本身就是练习。' },
        { text: '轻轻放下正在想的事，回到呼吸或双脚。', pause: 6 },
        { text: '走神多少次都没关系，回来就好。', detail: 'detailed' },
        { text: '呼吸的长短、快慢，都不需要调整，', detail: 'standard', minMinutes: 20 },
        { text: '只是知道它现在的样子。', detail: 'standard', minMinutes: 20, pause: 25 },
        { text: '如果留意的是鼻孔，', detail: 'detailed', minMinutes: 20 },
        { text: '也许能感到吸气微凉，呼气微温。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '也可以留意吸气转成呼气的那一下。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '发现走神了，就从下一次吸气重新开始。', detail: 'standard', minMinutes: 20 },
      ],
    },
    {
      id: 'body',
      title: '身体',
      weight: 1.6,
      minSilence: 6,
      omitAtOrBelow: 5,
      intro: [
        { text: '让觉察从呼吸放宽到整个身体。' },
        { text: '感受身体坐在这里的样子。', detail: 'detailed', pause: 3 },
        { text: '留意现在最明显的感觉，' },
        { text: '也许是压力、温度、刺麻，或者重量。', pause: 10 },
        { text: '不需要改变它们，只是知道它们在这里。', pause: 8 },
        { text: '最明显的那个感觉，从哪里开始，到哪里结束？', detail: 'detailed', pause: 4 },
        { text: '没有明显的感觉也没关系，那也是此刻的样子。', detail: 'standard' },
        { text: '也可以留意身体和座位、双脚和地面接触的地方。', detail: 'detailed', pause: 4 },
        { text: '如果哪里不舒服，可以先看看它是什么样的，', detail: 'standard' },
        { text: '是紧，是胀，还是一阵一阵的。', detail: 'detailed' },
        { text: '太强烈的时候，可以调整姿势，' },
        { text: '也可以回到呼吸，或者听听声音。', pause: 4 },
        { text: '要调整姿势的话，可以慢慢地、带着觉察去动。', detail: 'detailed', minMinutes: 20 },
        { text: '感觉出现、变化、消失，都由它去。', pause: 5 },
        { text: '再试着同时感受整个身体，', detail: 'standard', minMinutes: 20 },
        { text: '从头顶，一直到脚底。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '留意身体的感觉怎样变化，哪怕变化很小。', detail: 'detailed', minMinutes: 20, pause: 15 },
        { text: '哪里紧，哪里松？', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '也可以留意衣服贴着皮肤的地方。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '注意力跑开了，就回到身体的感觉上。', detail: 'standard', minMinutes: 20 },
      ],
    },
    {
      id: 'sounds',
      title: '声音',
      weight: 3,
      minSilence: 4,
      intro: [
        { text: '现在，把注意力放到声音上。' },
        { text: '不用去找，让声音自己来。', pause: 5 },
        { text: '远的、近的、响的、轻的。', detail: 'detailed', pause: 3 },
        { text: '听它们怎么出现，又怎么消失。', detail: 'standard', minMinutes: 10, pause: 12 },
        { text: '有新的声音时，听它是怎么开始的。', detail: 'detailed', minMinutes: 10, pause: 4 },
        { text: '心里也许会马上给声音起名字、下判断，' },
        { text: '比如认出是车声，或者觉得它吵。', detail: 'standard' },
        { text: '留意到这一下，就回到声音本身。' },
        { text: '它的高低、长短、强弱。', detail: 'detailed', minMinutes: 20, pause: 4 },
        { text: '分不清是什么声音，也没关系，只是听。', detail: 'detailed', minMinutes: 10 },
        { text: '喜欢的、不喜欢的，都允许它来，允许它走。', pause: 5 },
        { text: '没什么声音的时候，就听着安静。', detail: 'detailed', minMinutes: 10 },
        { text: '跟着一个声音想到了别处，', detail: 'standard', minMinutes: 10 },
        { text: '发现了，就回来，接着听。', detail: 'standard', minMinutes: 10, pause: 8 },
        { text: '听一听最远的那个声音。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '再听一听最近的那个。', detail: 'detailed', minMinutes: 20, pause: 6 },
        { text: '声音自己会传到耳朵里，不需要你做什么。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '想弄清是什么声音的时候，就留意这个想法。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '有的声音会让人烦，留意身体有什么反应，', detail: 'standard', minMinutes: 20 },
        { text: '然后再回到声音上。', detail: 'standard', minMinutes: 20, pause: 30 },
        { text: '声音和声音之间的安静，也可以听见。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '一直都在的声音，也可以听听它细小的变化。', detail: 'standard', minMinutes: 20 },
      ],
    },
    {
      id: 'thoughts',
      title: '想法和情绪',
      weight: 3,
      minSilence: 4,
      intro: [
        { text: '让声音慢慢退到背景里，', detail: 'standard' },
        { text: '把注意力转到想法上。' },
        { text: '每个想法，都只是心里发生的一件事。', detail: 'standard', pause: 3 },
        { text: '可以把想法当成电视剧的字幕，' },
        { text: '一句出现，一句过去。', pause: 4 },
        { text: '你看得见它，但不必跟着剧情走。', pause: 4 },
        { text: '想法有时是一句话，有时是一个画面。', detail: 'detailed', minMinutes: 20, pause: 4 },
        { text: '不用赶走它，也不用留住它。', pause: 5 },
        { text: '就这样，看一会儿。', detail: 'standard', minMinutes: 10, pause: 15 },
        { text: '一时没有想法，也没关系，等它自己出现。', detail: 'detailed', minMinutes: 10 },
        { text: '发现自己跟着一个想法走远了，', detail: 'standard' },
        { text: '那一刻就已经回神了，', detail: 'standard' },
        { text: '再回来，继续看着想法。', detail: 'standard', pause: 3 },
        { text: '也可以在心里轻轻标记一下：想法。', detail: 'detailed', minMinutes: 20, pause: 4 },
        { text: '有情绪的时候，留意它在身体的哪里。', pause: 3 },
        { text: '比如胸口发紧，或者喉咙发堵。', detail: 'detailed', minMinutes: 10 },
        { text: '也可以在心里叫出它的名字：担心，或者烦躁。', detail: 'detailed', minMinutes: 10 },
        { text: '让它在那里，看它怎么变化。', detail: 'standard', pause: 5 },
        { text: '如果被想法卷走或感到不安，' },
        { text: '就回到呼吸或声音。', pause: 6 },
        { text: '有的想法会反复出现，', detail: 'standard', minMinutes: 20 },
        { text: '那就看着它又来了一次。', detail: 'standard', minMinutes: 20, pause: 8 },
        { text: '想法说得再肯定、再严厉，', detail: 'standard', minMinutes: 10 },
        { text: '也是一句字幕，可以看着它过去。', detail: 'standard', minMinutes: 10, pause: 5 },
        { text: '心里要是跟着一紧，知道就好。', detail: 'detailed', minMinutes: 10, pause: 5 },
        { text: '有些想法很有吸引力，', detail: 'standard', minMinutes: 20 },
        { text: '留意那种想要跟上去的冲动。', detail: 'standard', minMinutes: 20, pause: 30 },
        { text: '想法和想法之间，也许会有一点空白。', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '也可以看看，想的是过去的事，还是将来的事。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '想法和情绪常常互相带动，这也可以看见。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '有点困的话，可以睁着眼睛，坐直一些。', detail: 'standard', minMinutes: 20, pause: 10 },
        { text: '想法来得快的时候，就只是知道：很多想法。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '想法也好，情绪也好，就这样看着。' },
      ],
    },
    {
      id: 'choiceless',
      title: '无拣择觉察',
      weight: 1.6,
      minSilence: 8,
      omitAtOrBelow: 5,
      skippable: true,
      intro: [
        { text: '接下来是无拣择觉察，' },
        { text: '不特意选什么，也不推开什么。', pause: 3 },
        { text: '如果这样让你不踏实，' },
        { text: '可以先回到呼吸或者声音，稳下来再放宽。', pause: 3 },
        { text: '此刻什么最明显，就觉察什么，' },
        { text: '声音、身体的感觉、想法或者情绪，都可以。', detail: 'standard', pause: 8 },
        { text: '它来了，知道它来了；它走了，知道它走了。', pause: 6 },
        { text: '这一刻，最明显的是什么？', detail: 'detailed', pause: 5 },
        { text: '一时什么都不明显，就感受整个身体。', detail: 'detailed', pause: 4 },
        { text: '觉察可以很宽，同时容下声音、身体和想法。', detail: 'standard', minMinutes: 20, pause: 20 },
        { text: '注意力被什么吸住的时候，', detail: 'standard', minMinutes: 20 },
        { text: '发现了，就再放开一点。', detail: 'standard', minMinutes: 20, pause: 25 },
        { text: '声音来了，就是声音；想法来了，就是想法。', detail: 'detailed', pause: 6 },
        { text: '不用急着去找下一个，等它自己出现。', detail: 'detailed', minMinutes: 20, pause: 8 },
        {
          text: '也许有一阵子，好像什么都没发生，这也没关系。',
          detail: 'standard',
          minMinutes: 20,
          pause: 15,
        },
      ],
    },
    {
      id: 'return',
      title: '回到呼吸',
      weight: 0.5,
      minSilence: 2,
      intro: [
        { text: '现在，把注意力收回到呼吸。' },
        { text: '感受一两次呼吸的来去。', detail: 'detailed', pause: 6 },
        { text: '再感受一下整个身体，坐在这里，呼吸着。', detail: 'standard', minMinutes: 20 },
        { text: '双脚和双手，现在是什么感觉？', detail: 'detailed', minMinutes: 20 },
      ],
    },
  ],
  closing: [
    { text: '之后也可以偶尔停一下，听听周围的声音。', detail: 'standard' },
    { text: '准备好时，抬起目光，看看四周。' },
  ],
}
