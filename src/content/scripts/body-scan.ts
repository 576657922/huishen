/**
 * 身体扫描（白天版）：从左脚开始，自下而上；5 / 10 / 20 分钟。
 *
 * 只借用已发表练习的结构，文字为原创，没有翻译或改写任何现成的引导词。
 * - 顺序（从左脚开始自下而上，左腿走完再走右腿）：练习笔记 §2.1（Harvard Health 2023；MBSR 惯例，无证据 id）
 * - 自我照顾原则、疼痛的处理（承认、探究，太强烈就回到呼吸）、情绪太强时换一个落点：practice-santorelli-2017
 * - 各时长的分段与人声占比（约 70% / 60% / 50%）、「把呼吸带到某个部位」：practice-uclamarc-2016，
 *   按练习笔记 §2.1 的模板，属于设计假设，需用真实录音实测
 * - 邀请式语言、可调整、可停下、可跳过部位、可以睁眼或换成双脚和声音：practice-baer-2019、safety-nccih-2021-relaxation
 * - 每次都教接纳：meditation-lindsay-2018；走神 → 发现 → 放下 → 回来，发现走神本身就是练习：practice-hasenkamp-2012
 * - 术语「身体扫描」：practice-kabatzinn-2018-zh
 * - 单独练身体扫描对健康结局的证据有限，所以引导词里不承诺任何效果：practice-gan-2022
 *
 * 写法：detail 不填为 core（任何档位都说），standard 为默认档，detailed 给新手；
 * minMinutes 用于 10 / 20 分钟版更细的部位和更多的停留。
 * 段落只能随时长增加、不能减少，所以 5 分钟版的腿部也按「左腿、右腿」两段走
 * （模板是双脚、小腿、大腿三段），这样 10 / 20 分钟版才能保持左腿走完再走右腿。
 * 每段先进入部位，长版本插入更细的部位，最后「感受整条左腿」之类的句子在各个时长下都读得通。
 * 停留写在句子里：10 分钟起的细部位之后停 4.5 秒，只在 20 分钟版出现的停 7 秒，
 * 所以长版本多出的时间花在每一处的停留上，部位末尾的整段静默保持在模板的 20–40 秒附近。
 * 开头和呼吸两段在选姿势、感受重量、跟随呼吸之后都留出几秒，不连着说上一两分钟。
 * 走神和回神放在不能跳过的「呼吸」一段里教，跳过任何部位都不会漏掉；
 * 每个邀请感受情绪的地方，紧跟着一条情绪太强时的退路。
 * 骨盆一带只提接触和重量，保持中性、简短，段落名写明「臀部」，想跳过的人在进度上看得到。
 * 档位间距：20 分钟版详细档比标准档多十个百分点左右，安静档少二十多个；10 分钟版详细档多九个左右。
 * 5 分钟版例外：标准档已是模板的密度（每处一两句，再停几秒到十秒），各段静默都在下限，
 * 详细档只多一句找感觉的提示，再多就没有静默了；安静档也要说完整的开头、安全提示、走神与回神和每处一句，
 * 只比标准档少十多个百分点。
 * v1 是文字引导（PRODUCT.md §0、§5）：每处一两句、隔几秒就换一句，所以开头只请人看着屏幕，读一句、感受一会儿。
 * 二十分钟版每处停留更久、常有二十秒以上的安静，才说可以闭眼、听到轻响再看屏幕；五分钟和十分钟版的
 * 标准档、详细档几乎没有这么长的安静，说了反而让人闭着眼错过下一句。犯困时的出口改成「睁着眼睛」，
 * 结尾改成「抬起目光」：读到这几句时，眼睛本来就是睁着的。
 */
import type { GuidedScript } from '@/content/types'

export const bodyScanScript: GuidedScript = {
  id: 'body-scan',
  title: '身体扫描',
  minMinutes: 5,
  maxMinutes: 20,
  opening: [
    { text: '身体扫描可以躺着练，也可以坐在椅子上。', pause: 4 },
    // 文字引导怎么看：任何档位都说；闭眼和轻响只在二十分钟版说（见文件头）
    { text: '目光落在屏幕上，看一句，感受一会儿。', pause: 3 },
    { text: '在一处停留久一些时，可以闭上眼睛，', minMinutes: 20 },
    { text: '新的一句出现，会有一声轻响。', minMinutes: 20, pause: 3 },
    // 安全提示：开头约二十秒说出，任何档位都说（safety.notes §5）
    { text: '如果留意某个部位让你难受，可以跳过它。' },
    { text: '也可以睁开眼睛，听听声音，或者感受双脚。' },
    { text: '任何时候，都可以调整姿势，或者停下来。' },
    { text: '躺着练的话，睡过去了也没关系。', detail: 'standard', minMinutes: 10 },
    { text: '身体扫描练的是觉察，放松不放松都可以。', detail: 'standard', minMinutes: 10, pause: 4 },
    { text: '注意力会从左脚开始，一处一处往上移。', detail: 'standard', minMinutes: 20 },
    { text: '身体是什么样，就感受它是什么样。', detail: 'standard' },
    { text: '不需要改变什么。' },
    { text: '先感受身体的重量。', detail: 'standard', pause: 4 },
    { text: '床、地面或椅子，在下面托着你。', detail: 'standard', minMinutes: 10, pause: 4 },
    { text: '哪里接触得多，哪里接触得少。', detail: 'detailed', minMinutes: 20, pause: 4 },
    { text: '也留意一下，自己此刻是什么状态。', detail: 'standard', minMinutes: 20 },
    { text: '累，还是清醒；平静，还是有点急。', detail: 'standard', minMinutes: 20, pause: 4 },
    { text: '不管是什么状态，都可以从这里开始。', detail: 'standard', minMinutes: 20 },
  ],
  sections: [
    {
      id: 'breath',
      title: '呼吸',
      weight: 0.7,
      minSilence: 4,
      intro: [
        { text: '把注意力放到腹部，感受呼吸。', pause: 4 },
        { text: '吸气时，腹部也许微微鼓起，呼气时回落。', detail: 'detailed', minMinutes: 20 },
        { text: '不需要控制呼吸，让身体自己呼吸。', pause: 3 },
        { text: '如果留意呼吸让你紧张，可以感受身体的重量。', detail: 'standard' },
        { text: '呼吸快一点，慢一点，都没关系。', detail: 'detailed', minMinutes: 20 },
        { text: '跟着一次吸气，从开始到结束。', detail: 'standard', minMinutes: 10, pause: 4 },
        { text: '再跟着一次呼气。', detail: 'standard', minMinutes: 10, pause: 5 },
        { text: '呼气之后，也许有一个短短的停顿。', detail: 'detailed', minMinutes: 20, pause: 4 },
        { text: '呼吸不好找的话，可以把一只手放在腹部。', detail: 'standard', minMinutes: 20, pause: 4 },
        // 走神与回神：在第一段较长的安静之前讲，任何部位被跳过都不会漏掉
        { text: '注意力会跑开，这很自然。', detail: 'standard' },
        { text: '发现走神的那一刻，就是回神。' },
        { text: '这本身就是练习。' },
        { text: '轻轻放下那个念头，回到正在感受的地方。' },
        { text: '就这样，跟着呼吸，停留一会儿。', detail: 'standard', minMinutes: 20 },
      ],
      reminders: ['走神了，就回到腹部的起伏。'],
    },
    {
      id: 'left-leg',
      title: '左腿',
      weight: 0.7,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '现在，把注意力移到左脚。' },
        { text: '留意左脚此刻有什么感觉。', pause: 3 },
        { text: '可能是温度、压力，或者刺麻。', detail: 'standard' },
        { text: '没有感觉，就知道没有感觉，这也是觉察。' },
        { text: '找不到感觉的话，先留意脚跟碰到的地方。', detail: 'detailed' },
        { text: '先是左脚的脚趾。', minMinutes: 10, pause: 4.5 },
        { text: '大脚趾，小脚趾，还有中间的几根。', minMinutes: 20, pause: 7 },
        { text: '然后是脚底，从脚掌到脚跟。', minMinutes: 10, pause: 4.5 },
        { text: '脚心，那一块不太碰到东西的地方。', minMinutes: 20, pause: 7 },
        { text: '脚跟碰到下面的地方，那里的压力。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '再到脚背和脚踝。', minMinutes: 10, pause: 4.5 },
        { text: '脚背上，也许能感觉到空气，或者袜子。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '然后是小腿，前面和后面。', minMinutes: 10, pause: 4.5 },
        { text: '小腿肚，还有小腿两侧。', minMinutes: 20, pause: 7 },
        { text: '膝盖，还有膝盖后面。', minMinutes: 10, pause: 4.5 },
        { text: '再到大腿。', minMinutes: 10, pause: 4.5 },
        { text: '大腿的前面和后面，还有那里的重量。', minMinutes: 20, pause: 7 },
        { text: '感觉会变，刚才有的，现在也许没有了。', detail: 'detailed', minMinutes: 20, pause: 10 },
        { text: '感受整条左腿，从脚趾到大腿。', pause: 3 },
        { text: '如果你愿意，可以把呼吸带到这里。', detail: 'standard', minMinutes: 20 },
        { text: '吸气时，好像气息一路流到左脚。', detail: 'standard', minMinutes: 20, pause: 3 },
        { text: '呼气时，再从腿上流回来。', detail: 'standard', minMinutes: 20, pause: 4 },
        { text: '呼吸还是平常那样，不用吸得更深。', detail: 'standard', minMinutes: 20 },
        { text: '这只是一种想象，做不到也没关系。', detail: 'detailed', minMinutes: 20 },
      ],
      reminders: ['没有感觉，也可以只是知道。', '留意左腿此刻的感觉。'],
    },
    {
      id: 'right-leg',
      title: '右腿',
      weight: 0.6,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '接着，把注意力移到右脚。', pause: 4 },
        { text: '脚趾，脚底，脚跟。', minMinutes: 10, pause: 4.5 },
        { text: '两只脚的感觉，也许不太一样。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '脚背，脚踝。', minMinutes: 10, pause: 4.5 },
        { text: '小腿，膝盖。', minMinutes: 10, pause: 4.5 },
        { text: '膝盖后面，那一块柔软的地方。', minMinutes: 20, pause: 7 },
        { text: '然后是大腿。', minMinutes: 10, pause: 4.5 },
        { text: '大腿和下面接触的地方，那里的重量。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '腿上的感觉，也许比脚上模糊一些。', detail: 'detailed', minMinutes: 20, pause: 10 },
        { text: '感受整条右腿，从脚趾到大腿。', pause: 3 },
        { text: '吸气时，气息流到右腿；呼气时，再流回来。', detail: 'standard', minMinutes: 20, pause: 4 },
        { text: '再同时感受两条腿。', minMinutes: 20, pause: 4 },
        { text: '如果注意力跑开了，发现了，就回到腿上。', detail: 'standard', minMinutes: 10 },
        { text: '走神多少次，就回来多少次。', detail: 'detailed', minMinutes: 10 },
      ],
      reminders: ['留意右腿此刻的感觉。', '走神了，就回到腿上。'],
    },
    {
      id: 'lower-torso',
      title: '臀部、腹部和后腰',
      weight: 0.6,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '注意力往上，来到臀部和骨盆。' },
        { text: '感受这里压在下面的重量。', detail: 'standard', minMinutes: 20, pause: 3 },
        { text: '然后是腹部，随着呼吸起伏。', pause: 3 },
        { text: '肚脐周围，还有腹部两侧。', minMinutes: 20, pause: 7 },
        { text: '腹部表面，衣服贴着的地方。', detail: 'standard', minMinutes: 10, pause: 4.5 },
        { text: '也许还能感觉到肚子里的一些动静。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '腹部是收着的，还是松的，都只是知道。', detail: 'detailed', minMinutes: 20, pause: 10 },
        { text: '再到后腰，那里是紧，是松，还是有点酸。', pause: 3 },
        { text: '后腰随着呼吸，也许也在轻轻动。', detail: 'standard', minMinutes: 20, pause: 7 },
        {
          text: '吸气时，好像气息来到后腰；呼气时，慢慢散开。',
          detail: 'standard',
          minMinutes: 20,
          pause: 3,
        },
        // 疼痛：先承认，再探究它的样子，太强烈就回到呼吸（practice-santorelli-2017）
        { text: '如果哪里疼，或者不舒服，先知道它在那里。', detail: 'standard', minMinutes: 10 },
        { text: '可以留意它的样子，是刺痛，还是钝痛。', detail: 'standard', minMinutes: 10, pause: 3 },
        { text: '是一直一样，还是时强时弱。', detail: 'detailed', minMinutes: 20, pause: 3 },
        { text: '疼得太厉害，可以回到呼吸，或者跳过这里。', minMinutes: 10 },
      ],
      reminders: ['留意腹部和后腰。', '走神了，就轻轻回来。'],
    },
    {
      id: 'upper-torso',
      title: '胸口、后背和肩膀',
      weight: 0.6,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '再往上，来到胸口和后背。' },
        { text: '感受胸口和后背随着呼吸起伏。', detail: 'standard', pause: 3 },
        { text: '胸口中间，锁骨下面。', minMinutes: 20, pause: 7 },
        { text: '肋骨两侧，也在跟着呼吸动。', detail: 'standard', minMinutes: 10, pause: 4.5 },
        { text: '后背上面，两块肩胛骨。', minMinutes: 10, pause: 4.5 },
        { text: '后背碰到的地方，有压力，也有温度。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '吸气时，气息进到胸口；呼气时，再慢慢出去。', detail: 'standard', minMinutes: 20, pause: 4 },
        { text: '注意力停久一点，感觉有时会清楚一些。', detail: 'detailed', minMinutes: 20, pause: 10 },
        // 邀请感受情绪，紧跟着退路
        { text: '胸口如果有什么情绪，也允许它在这里。', detail: 'detailed', minMinutes: 10 },
        { text: '情绪太强的话，可以睁开眼睛，或者感受双脚。', detail: 'detailed', minMinutes: 10, pause: 3 },
        { text: '然后是肩膀。', pause: 3 },
        { text: '左肩，右肩。', minMinutes: 20, pause: 7 },
        { text: '肩膀常常不知不觉地绷着。', detail: 'detailed', minMinutes: 10 },
        { text: '它想松下来，就让它松；不松，也没关系。', detail: 'standard', minMinutes: 10 },
        // 犯困：练到一半最常见；白天版给出保持清醒的办法，睡过去也没关系在开头已经说过
        { text: '练到这里有点犯困，很常见。', detail: 'standard', minMinutes: 10 },
        { text: '想保持清醒，可以睁着眼睛，或者坐起来。', detail: 'standard', minMinutes: 10 },
      ],
      reminders: ['留意胸口、后背和肩膀。'],
    },
    {
      id: 'arms',
      title: '双手和手臂',
      weight: 0.6,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '把注意力移到两只手，留意此刻的感觉。', pause: 3 },
        { text: '指尖，手指，手指之间。', minMinutes: 10, pause: 4.5 },
        { text: '五根手指，一根一根地感受。', minMinutes: 20, pause: 8 },
        { text: '指尖也许有一点刺麻，或者微微跳动。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '掌心，手背。', minMinutes: 10, pause: 4.5 },
        { text: '手放在哪里，就感受碰到的那个地方。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '两只手，哪一只暖一点？', detail: 'detailed', minMinutes: 20, pause: 8 },
        { text: '然后是手腕，前臂，手肘。', minMinutes: 10, pause: 4.5 },
        { text: '再到上臂，一直到肩膀。', minMinutes: 10, pause: 4.5 },
        { text: '感受两条手臂，从指尖到肩膀。', pause: 3 },
        { text: '有感觉也好，没感觉也好，都只是知道。', detail: 'detailed', minMinutes: 10 },
        {
          text: '吸气时，好像气息流到手上；呼气时，从指尖出去。',
          detail: 'standard',
          minMinutes: 20,
          pause: 3,
        },
        { text: '无聊或者不耐烦，也可以只是留意。', detail: 'standard', minMinutes: 20 },
        { text: '想动一动的话，可以慢慢动，再回来。', detail: 'standard', minMinutes: 20 },
      ],
      reminders: ['留意双手和手臂。'],
    },
    {
      id: 'head',
      title: '脖子、脸和头部',
      weight: 0.6,
      minSilence: 4,
      skippable: true,
      intro: [
        { text: '注意力来到脖子。', pause: 3 },
        { text: '脖子后面，两侧，还有前面。', minMinutes: 20, pause: 7 },
        { text: '然后是脸。', pause: 3 },
        { text: '某个部位一下子找不到，可以停在它附近。', detail: 'detailed', minMinutes: 10 },
        { text: '下巴，嘴唇，舌头。', minMinutes: 10, pause: 4.5 },
        { text: '下巴是咬紧的，还是松开的。', detail: 'standard', minMinutes: 10, pause: 4.5 },
        { text: '舌头放在哪里，碰到了哪里。', minMinutes: 20, pause: 7 },
        { text: '脸颊，鼻子，空气进出鼻孔的感觉。', minMinutes: 10, pause: 4.5 },
        { text: '留意吸进来的空气凉不凉，呼出去的暖不暖。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '眼睛，眼皮，眼睛周围。', minMinutes: 10, pause: 4.5 },
        { text: '眼皮也许会轻轻跳动，留意到就好。', detail: 'detailed', minMinutes: 20, pause: 10 },
        { text: '眉毛，额头，太阳穴。', minMinutes: 10, pause: 4.5 },
        { text: '额头的皮肤，是紧一点，还是松一点。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '耳朵，后脑，头顶。', minMinutes: 10, pause: 4.5 },
        { text: '耳朵也许能听到周围的声音。', detail: 'standard', minMinutes: 20, pause: 7 },
        { text: '最后，是整个头皮。', minMinutes: 20, pause: 7 },
        { text: '感受整个头部，从下巴到头顶。', pause: 3 },
        { text: '脸上的感觉很细，留意到一点点就够了。', detail: 'detailed', minMinutes: 10 },
        { text: '脸上不需要任何表情。', detail: 'detailed', minMinutes: 20 },
        {
          text: '吸气时，好像气息到了头顶；呼气时，从头顶散开。',
          detail: 'standard',
          minMinutes: 20,
          pause: 3,
        },
      ],
      reminders: ['留意脸上和头部的感觉。'],
    },
    {
      id: 'whole',
      title: '全身',
      weight: 2,
      minSilence: 10,
      intro: [
        { text: '现在，把注意力放宽，感受整个身体。' },
        { text: '从头顶到脚底，整个身体在呼吸。', detail: 'standard', pause: 4 },
        { text: '身体的前面，后面，左边，右边。', minMinutes: 20, pause: 4.5 },
        { text: '吸气和呼气，全身都在跟着动。', detail: 'standard', minMinutes: 10, pause: 4.5 },
        { text: '此刻有什么感觉，都允许它在这里。', pause: 3 },
        { text: '不评判，只是感受身体本来的样子。', detail: 'detailed', minMinutes: 10, pause: 3 },
        { text: '不用再找哪一个部位，只是感受整个身体。', detail: 'detailed', minMinutes: 20, pause: 12 },
        { text: '犯困的话，可以睁着眼睛，继续感受。', detail: 'detailed', minMinutes: 20, pause: 12 },
        { text: '接下来的一段时间，就这样安静地感受。', detail: 'standard', minMinutes: 20 },
      ],
      reminders: ['整个身体，在这里呼吸。', '走神了，就回到整个身体。'],
    },
  ],
  closing: [
    { text: '慢慢动一动手指和脚趾。', pause: 3 },
    { text: '想伸展一下，就伸展一下。', detail: 'standard', minMinutes: 10 },
    { text: '准备好时，抬起目光，看看四周。' },
    { text: '不用急着起来，可以再停留一会儿。', detail: 'standard', minMinutes: 20 },
    { text: '如果是躺着练的，起身时慢一点。' },
    { text: '之后做事时，也可以偶尔留意一下身体。', detail: 'standard', minMinutes: 10 },
  ],
}
