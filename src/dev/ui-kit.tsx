/**
 * 组件目录（只在开发时用，ui-kit.html，不进生产构建）：每个组件的每种状态，浅色和深色并排。
 *   /ui-kit.html               浅色 | 深色（窄屏上下排）
 *   /ui-kit.html?theme=dark    只看深色（?theme=light 只看浅色）
 *   /ui-kit.html?section=rows  只看一节
 *   /ui-kit.html?open=sheet    打开一个浮层：sheet · sheet-player · dialog · toast
 * 带 data-force 的元素（或 data-force-child 里第 data-force-index 个可聚焦的元素）显示成 :hover / :active /
 * :focus-visible：页面启动后把样式表里带这些伪类的规则各复制一份，伪类换成 [data-force~="…"]，插在原规则
 * 后面（同一个 @media 里）。用的是组件自己的 CSS，所以普通浏览器、scripts/dev-shot.mjs 的截图和
 * 用 CSS.forcePseudoState 的脚本看到的都一样（设计稿 states.html 的做法）。
 * 目录自己的说明文字用英文：它不给用户看，也不把字带进字体子集。
 */
import { type ReactNode, StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import {
  CATALOGUE,
  DETAIL,
  EVIDENCE,
  GRADE_NAMES,
  PACE_FINDER,
  PLAYER,
  RECORDS,
  SETTINGS,
  SUMMARY,
  TODAY,
} from '@/content/copy'
import {
  citeHref,
  citeLabel,
  citeLine,
  effectAxis,
  effectNote,
  formatEffect,
  formatSize,
  metaLine,
} from '@/content/evidence'
import { EVIDENCE_CARDS, EVIDENCE_CITES } from '@/content/evidence-cards'
import { CATEGORY_LABEL, PRACTICE_BY_ID, PRACTICES } from '@/content/practices'
import { PROGRAMS } from '@/content/programs'
import {
  AFTER_PRACTICE,
  CRISIS_CARD,
  CRISIS_RESOURCES,
  FIRST_RUN_NOTICE,
  STOP_GUIDANCE,
} from '@/content/safety'
import { getScript } from '@/content/scripts'
import { AMBIENCES, MUSIC } from '@/content/sounds'
import { QUICK_PICKS } from '@/content/today'
import type { EvidenceCard as EvidenceCardData } from '@/content/types'
import { buildTimeline } from '@/engine'
import { WEEKDAYS } from '@/lib/date'
import {
  BreathGlyph,
  BreathSpecimen,
  Button,
  ButtonLink,
  CheckinStrips,
  Chip,
  ChoiceGroup,
  Cite,
  Claims,
  ConfirmDialog,
  CountRows,
  DialGrid,
  Disclosure,
  DisclosureRow,
  Dock,
  DotPlot,
  EffectRows,
  EmergencyLine,
  EmptyState,
  EvidenceCard,
  type EvidenceField,
  Figure,
  FilterRow,
  FocusTimeline,
  GLYPH_IDS,
  GradeMark,
  ICON_NAMES,
  Icon,
  IconButton,
  Kbd,
  Kicker,
  Lead,
  LinkMore,
  ListGroup,
  MonthCalendar,
  NavRow,
  Notes,
  Overview,
  PageHead,
  PhoneRow,
  PracticeBars,
  PracticeList,
  PracticeRow,
  Readouts,
  Reveal,
  Row,
  ScaleGroup,
  SectionHead,
  SectionStrip,
  Segmented,
  SessionsTable,
  Sheet,
  Slider,
  SourceLine,
  Sparkline,
  StackRow,
  StartBar,
  StepChart,
  Stepper,
  Steps,
  stepLabel,
  stepSections,
  Tag,
  TextField,
  ToastHost,
  Toggle,
  ToggleRow,
  timesText,
  Unit,
  useToast,
  type WeekDay,
  WeekDots,
} from '@/ui'
import styles from './ui-kit.module.css'

type Theme = 'light' | 'dark'
const params = new URLSearchParams(location.search)
const onlyTheme = params.get('theme') as Theme | null
const onlySection = params.get('section')
const openOverlay = params.get('open')

const mainland = CRISIS_RESOURCES[0]?.lines ?? []

/* ---------- 演示数据：与设计稿同一个早晨（2026-10-22，星期四） ---------- */
const WEEK: WeekDay[] = [
  { date: '2026-10-19', minutes: 15, state: 'past' },
  { date: '2026-10-20', minutes: 0, state: 'past' },
  { date: '2026-10-21', minutes: 21, state: 'past' },
  { date: '2026-10-22', minutes: 10, state: 'today' },
  { date: '2026-10-23', minutes: 0, state: 'future' },
  { date: '2026-10-24', minutes: 0, state: 'future' },
  { date: '2026-10-25', minutes: 0, state: 'future' },
]
const PRACTISED = new Set(
  [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22].map(
    d => `2026-10-${String(d).padStart(2, '0')}`,
  ),
)
const FOCUS_POINTS = [
  { date: '2026-10-05', value: 9 },
  { date: '2026-10-06', value: 8 },
  { date: '2026-10-07', value: 6 },
  { date: '2026-10-09', value: 6 },
  { date: '2026-10-10', value: 7 },
  { date: '2026-10-11', value: 6 },
  { date: '2026-10-12', value: 7 },
  { date: '2026-10-13', value: 5 },
  { date: '2026-10-14', value: 8 },
  { date: '2026-10-15', value: 6 },
  { date: '2026-10-16', value: 6 },
  { date: '2026-10-17', value: 4 },
  { date: '2026-10-18', value: 5 },
  { date: '2026-10-19', value: 7.5 },
  { date: '2026-10-22', value: 7, today: true },
]

/* ---------- 强制状态 ---------- */

const STATE_PSEUDO = ':(hover|active|focus-visible|focus-within|focus)(?![\\w-])'
const HAS_PSEUDO = new RegExp(STATE_PSEUDO)
const PSEUDO = new RegExp(STATE_PSEUDO, 'g')
const forced = (state: string): string => `[data-force~="${state}"]`
const FORCED_SELECTOR: Record<string, string> = {
  hover: forced('hover'),
  active: forced('active'),
  'focus-visible': forced('focus-visible'),
  focus: forced('focus'),
  // 焦点在里面（表格行的「详情」「删除」）
  'focus-within': `:is(${forced('focus')}, :has(${forced('focus')}))`,
}

/** 规则表里每条带状态伪类的规则后面，插一条换成 [data-force] 的副本；分组规则（@media 等）递归处理 */
function copyStateRules(list: CSSRuleList, insert: (rule: string, index: number) => void) {
  for (let i = list.length - 1; i >= 0; i--) {
    const rule = list[i]
    if (rule instanceof CSSGroupingRule) {
      copyStateRules(rule.cssRules, (text, at) => rule.insertRule(text, at))
    } else if (rule instanceof CSSStyleRule && HAS_PSEUDO.test(rule.selectorText)) {
      const selector = rule.selectorText.replace(PSEUDO, (_, name: string) => FORCED_SELECTOR[name] ?? '')
      insert(`${selector} { ${rule.style.cssText} }`, i + 1)
    }
  }
}

let statesInstalled = false
function installForcedStates() {
  // 组里第 index 个可聚焦的元素（分段格、单选格、步进器的按钮……）
  for (const wrap of document.querySelectorAll<HTMLElement>('[data-force-child]')) {
    const items = wrap.querySelectorAll<HTMLElement>(
      wrap.dataset.forceSelect ?? 'a[href], button, input, textarea, select, [tabindex]',
    )
    items[Number(wrap.dataset.forceIndex ?? 0)]?.setAttribute('data-force', wrap.dataset.forceChild ?? '')
  }
  // :focus-visible 的元素同时算 :focus（文本框的焦点样式写在 :focus 上）
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-force~="focus-visible"]:not([data-force~="focus"])',
  )) {
    el.dataset.force = `${el.dataset.force} focus`
  }
  if (statesInstalled) return
  statesInstalled = true
  for (const sheet of document.styleSheets) {
    try {
      copyStateRules(sheet.cssRules, (text, at) => sheet.insertRule(text, at))
    } catch {
      // 别的源的样式表（字体）读不到规则，跳过
    }
  }
}

/* ---------- 目录的骨架 ---------- */

function Spec({ children }: { children: ReactNode }) {
  return <p className={styles.spec}>{children}</p>
}

function Cell({
  spec,
  children,
  wide = false,
  full = false,
}: {
  spec: string
  children: ReactNode
  wide?: boolean
  full?: boolean
}) {
  return (
    <div className={full ? styles.cellFull : wide ? styles.cellWide : styles.cell}>
      <Spec>{spec}</Spec>
      {children}
    </div>
  )
}

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  if (onlySection && onlySection !== id) return null
  return (
    <section className={styles.part} aria-label={title} data-part={id}>
      <h2 className={styles.partTitle}>{title}</h2>
      {children}
    </section>
  )
}

/* ---------- 各节 ---------- */

/** 「八周正念 · 第 3 周第 2 天」：只有计划名是次级墨色 600（today.png） */
function ProgramDay() {
  const [name, ...rest] = TODAY.program.day(PROGRAMS['mindfulness-8w'].title, 3, 2).split(' · ')
  return (
    <>
      <b>{name}</b>
      {rest.length > 0 && ` · ${rest.join(' · ')}`}
    </>
  )
}

/** 强制组里第 index 个可聚焦元素（分段、单选格、拨号格）——或第 index 个 selector 选中的元素——的状态 */
function Force({
  state,
  index = 0,
  selector,
  children,
}: {
  state: string
  index?: number
  selector?: string
  children: ReactNode
}) {
  return (
    <div data-force-child={state} data-force-index={index} data-force-select={selector}>
      {children}
    </div>
  )
}

function Type() {
  return (
    <Part id="type" title="Type scale">
      <Cell spec="display 32/40 · title 24/32 · head 20/28 · name 17/24 (HS Display 600, 0.04em)">
        <p className="t-display">{TODAY.title}</p>
        <p className="t-title">{PLAYER.paused}</p>
        <p className="t-head">{TODAY.quick.title}</p>
        <p className="t-name">{PRACTICE_BY_ID.slow.name}</p>
      </Cell>
      <Cell spec="reading 17/28 · body 15/24 · caption 13/20 · micro 11/16 (system CJK + Inter)">
        <p className="t-reading">{PRACTICE_BY_ID.slow.short}</p>
        <p className="t-body">{TODAY.hard.intro}</p>
        <p className="t-caption ink-3">{RECORDS.calendar}</p>
        <p className="t-micro ink-3">{TODAY.week.title}</p>
      </Cell>
      <Cell spec="figures: figure 40 · timer 32 · readout 24 (Inter 300) · units caption ink-2">
        <p>
          <span className="t-figure">19</span>
          <Unit>{TODAY.week.value(19, 238).split(' ')[1]}</Unit>
        </p>
        <p className="t-timer">06:15</p>
        <p className={styles.readout}>
          5.5<Unit>{PLAYER.paced.rate(5.5).split(' ')[1]}</Unit>
        </p>
      </Cell>
    </Part>
  )
}

function Icons() {
  return (
    <Part id="icons" title="Icons">
      <Cell spec="51 symbols · 24 · stroke 1.5 · currentColor" wide>
        <div className={styles.iconGrid}>
          {ICON_NAMES.map(name => (
            <span key={name} className={styles.iconCell} title={name}>
              <Icon name={name} />
              <span className={styles.iconName}>{name}</span>
            </span>
          ))}
        </div>
      </Cell>
      <Cell spec="sizes 24 · 20 · 18 · 16 · 14; ink · ink-2 · ink-3">
        <div className={styles.row}>
          <Icon name="settings" size={24} />
          <Icon name="settings" size={20} />
          <Icon name="settings" size={18} />
          <Icon name="settings" size={16} />
          <Icon name="settings" size={14} />
          <span className="ink-2">
            <Icon name="sound" size={20} />
          </span>
          <span className="ink-3">
            <Icon name="chevron-right" size={16} />
          </span>
        </div>
      </Cell>
    </Part>
  )
}

function Buttons() {
  return (
    <Part id="buttons" title="Buttons">
      <Cell spec="primary — default · hover · pressed · focus-visible · disabled">
        <div className={styles.stack}>
          <Button variant="primary">{SUMMARY.done}</Button>
          <Button variant="primary" data-force="hover">
            {SUMMARY.done}
          </Button>
          <Button variant="primary" data-force="active">
            {SUMMARY.done}
          </Button>
          <Button variant="primary" data-force="focus-visible">
            {SUMMARY.done}
          </Button>
          <Button variant="primary" disabled>
            {SUMMARY.done}
          </Button>
        </div>
      </Cell>
      <Cell spec="secondary — default · hover · pressed · focus-visible · disabled">
        <div className={styles.stack}>
          <Button icon="download">{SETTINGS.data.export.label}</Button>
          <Button icon="download" data-force="hover">
            {SETTINGS.data.export.label}
          </Button>
          <Button icon="download" data-force="active">
            {SETTINGS.data.export.label}
          </Button>
          <Button icon="download" data-force="focus-visible">
            {SETTINGS.data.export.label}
          </Button>
          <Button icon="download" disabled>
            {SETTINGS.data.export.label}
          </Button>
        </div>
      </Cell>
      <Cell spec="quiet (18 icon) · danger (trash 20) · small 36 (target 44) · block">
        <div className={styles.row}>
          <Button variant="quiet" icon="refresh">
            {TODAY.change}
          </Button>
          <Button variant="quiet" icon="refresh" data-force="hover">
            {TODAY.change}
          </Button>
          <Button variant="quiet" disabled>
            {SUMMARY.checkin.skip}
          </Button>
        </div>
        <div className={styles.row}>
          <Button variant="danger">{RECORDS.list.delete}</Button>
          <Button variant="danger" data-force="focus-visible">
            {RECORDS.list.delete}
          </Button>
          <Button size="sm" icon="upload">
            {SETTINGS.data.import.label}
          </Button>
        </div>
        <div className={styles.stackWide}>
          <Button variant="primary" block>
            {STOP_GUIDANCE.actions.grounding}
          </Button>
          <ButtonLink to="/practices" block>
            {SETTINGS.data.export.csv}
          </ButtonLink>
        </div>
      </Cell>
      <Cell spec="icon button 44 — default · hover · pressed · focus · disabled · link-more">
        <div className={styles.row}>
          <IconButton icon="settings" label={SETTINGS.title} />
          <IconButton icon="settings" label={SETTINGS.title} data-force="hover" />
          <IconButton icon="close" label={SUMMARY.close} data-force="active" />
          <IconButton icon="back" label={RECORDS.prevMonth} data-force="focus-visible" />
          <IconButton icon="chevron-right" label={RECORDS.nextMonth} disabled />
        </div>
        <div className={styles.row}>
          <LinkMore to="/help">{TODAY.hard.help.label}</LinkMore>
          <span data-force="focus-visible" className={styles.forceWrap}>
            <LinkMore to="/evidence">{EVIDENCE.title}</LinkMore>
          </span>
          <LinkMore to="/help" size="caption">
            {TODAY.hard.help.label}
          </LinkMore>
        </div>
      </Cell>
      <Cell spec="start bar 56 — default · hover · focus-visible; approx; dock (static here)">
        <div className={styles.stack}>
          <StartBar to="/play/body-scan" minutes={10} />
          <StartBar to="/play/slow" minutes={5} data-force="hover" />
          <StartBar onStart={() => {}} minutes={7} approx />
        </div>
        <div className={styles.dockDemo}>
          <Dock className={styles.dockStatic}>
            <StartBar to="/play/slow" minutes={5} />
          </Dock>
        </div>
      </Cell>
    </Part>
  )
}

function Heads() {
  return (
    <Part id="heads" title="Page head · section head · kicker">
      <Cell spec="page head + folio (phone; 练习 / 依据 on desktop)">
        <PageHead title={CATALOGUE.title} folioStart={CATALOGUE.folio(17)} folioEnd={CATALOGUE.folioEnd} />
      </Cell>
      <Cell spec="page head, desktop subline variant with actions">
        <PageHead
          variant="subline"
          title={RECORDS.title}
          subline={RECORDS.sessions(29)}
          actions={
            <Button size="sm" icon="download">
              {SETTINGS.data.export.label}
            </Button>
          }
        />
      </Cell>
      <Cell spec="section head: 1 px ink rule, h2 20/28, aside caption ink-3 / link-more / icon buttons">
        <SectionHead title={TODAY.quick.title} />
        <div className={styles.gap} />
        <SectionHead title={CATEGORY_LABEL.meditation} aside={CATALOGUE.count(10)} />
        <div className={styles.gap} />
        <SectionHead
          title={DETAIL.sections.evidence}
          aside={<LinkMore to="/evidence">{DETAIL.allEvidence}</LinkMore>}
        />
        <div className={styles.gap} />
        <SectionHead
          title={RECORDS.title}
          aside={
            <span className={styles.monthNav}>
              <IconButton icon="back" label={RECORDS.prevMonth} />
              <IconButton icon="chevron-right" label={RECORDS.nextMonth} disabled />
            </span>
          }
        />
      </Cell>
      <Cell spec="kicker (grade with 证据) · display title · lead · tag · kbd">
        <Kicker start={<ProgramDay />} end={<GradeMark grade="C" prefix />} />
        <h3 className="t-display">{PRACTICE_BY_ID['body-scan'].name}</h3>
        <Lead>{PRACTICE_BY_ID['body-scan'].short}</Lead>
        <div className={styles.row}>
          <Tag>{RECORDS.checkin.tag}</Tag>
          <span className="t-caption ink-3">
            {PLAYER.focus.markHintKeys} <Kbd>{PLAYER.focus.markKey}</Kbd>
          </span>
        </div>
        <Kicker start={TODAY.welcomeBack} tone="note" />
      </Cell>
      <Cell spec="grade marks A–D · with prefix · box only (catalogue) · fill (tables)">
        <div className={styles.stack}>
          {(['A', 'B', 'C', 'D'] as const).map(g => (
            <GradeMark key={g} grade={g} />
          ))}
          <GradeMark grade="B" prefix />
          <GradeMark grade={null} fill />
          <span className="ink-3 t-caption">{Object.values(GRADE_NAMES).join(' · ')}</span>
        </div>
      </Cell>
    </Part>
  )
}

function Rows() {
  const catalogue = PRACTICES.filter(p => p.category === 'meditation').slice(0, 5)
  return (
    <Part id="rows" title="Practice rows · glyphs">
      <Cell spec="今日 · 只有几分钟 (structure line, hint via aria-describedby) + 现在有点难 nav row">
        <PracticeList>
          {QUICK_PICKS.map(q => (
            <PracticeRow
              key={q.practiceId}
              practice={PRACTICE_BY_ID[q.practiceId as keyof typeof PRACTICE_BY_ID]}
              name={q.label}
              description={q.structure}
              hint={q.hint}
              minutes={q.minutes}
              to={`/play/${q.practiceId}`}
            />
          ))}
          <PracticeRow
            variant="nav"
            glyph="grounding"
            name={TODAY.hard.title}
            description={TODAY.hard.rowHint}
            end="chevron"
            onClick={() => {}}
            opensDialog
          />
        </PracticeList>
      </Cell>
      <Cell spec="练习 catalogue: grade letter after the name · hover · pressed · focus (ring inside the margin)">
        <PracticeList>
          {catalogue.map((p, i) => (
            <PracticeRow
              key={p.id}
              practice={p}
              showGrade
              minutes={p.defaultMinutes}
              to={`/practices/${p.id}`}
              {...(i === 1
                ? { 'data-force': 'hover' }
                : i === 2
                  ? { 'data-force': 'active' }
                  : i === 3
                    ? { 'data-force': 'focus-visible' }
                    : {})}
            />
          ))}
        </PracticeList>
      </Cell>
      <Cell spec="programmes (one square per week) · 约 7 分钟 · 60 秒">
        <PracticeList>
          <PracticeRow
            glyph={{ weeks: 8 }}
            name={PROGRAMS['mindfulness-8w'].title}
            description={CATALOGUE.programs.inProgress(3, 2)}
            end="weeks"
            weeks={8}
            to="/program/mindfulness-8w"
          />
          <PracticeRow
            glyph={{ weeks: 4 }}
            name={PROGRAMS['breathing-4w'].title}
            description={CATALOGUE.programs.plan['breathing-4w']}
            end="weeks"
            weeks={4}
            to="/program/breathing-4w"
          />
          <PracticeRow
            practice={PRACTICE_BY_ID['pace-finder']}
            showGrade
            endText={PACE_FINDER.duration}
            to="/pace-finder"
          />
          <PracticeRow
            practice={PRACTICE_BY_ID.grounding}
            name={TODAY.hard.grounding.label}
            description={TODAY.hard.grounding.hint}
            endText={TODAY.hard.grounding.duration}
            to="/play/grounding"
          />
        </PracticeList>
      </Cell>
      <Cell spec="glyph vocabulary 48 × 24 (paced ones sampled from the engine) · 4× figure" wide>
        <div className={styles.glyphGrid}>
          {GLYPH_IDS.map(id => (
            <span key={id} className={styles.glyphCell}>
              <BreathGlyph id={id} />
              <span className={styles.iconName}>{id}</span>
            </span>
          ))}
          <span className={styles.glyphCell}>
            <BreathGlyph weeks={8} />
            <span className={styles.iconName}>program 8</span>
          </span>
        </div>
        <div className={styles.row}>
          <BreathGlyph id="breath-count" scale={4} />
          <BreathGlyph id="timer" scale={4} />
        </div>
      </Cell>
    </Part>
  )
}

function Lists() {
  const [warm, setWarm] = useState(true)
  const [bells, setBells] = useState(false)
  const [rate, setRate] = useState(5.5)
  const [ratio, setRatio] = useState<'long' | 'equal'>('long')
  const [minutes, setMinutes] = useState(5)
  const cue = SETTINGS.sound.cueStyle.options
  const [cueStyle, setCueStyle] = useState<keyof typeof cue>('glide')
  return (
    <Part id="lists" title="List rows · settings">
      <Cell spec="group title · nav row (value + chevron) · toggle rows (whole row toggles) · info row · danger row">
        <ListGroup title={SETTINGS.sound.title}>
          <NavRow
            label={SETTINGS.sound.defaults.label}
            value={`${AMBIENCES[0]?.name ?? ''} + ${MUSIC[0]?.name ?? ''}`}
            to="/settings/sound"
          />
          <ToggleRow
            label={SETTINGS.sound.bells.label}
            hint={SETTINGS.sound.bells.help}
            checked={bells}
            onChange={setBells}
          />
          <ToggleRow label={SETTINGS.sound.cues.label} checked={!bells} onChange={v => setBells(!v)} />
          <Row label={SETTINGS.data.storage.label} hint={SETTINGS.data.storage.indexeddb} />
          <Row
            label={SETTINGS.data.deleteAll.label}
            end={<Button variant="danger">{RECORDS.list.delete}</Button>}
          />
          <DisclosureRow label={RECORDS.streakNote.title}>
            <p className={styles.reveal}>{RECORDS.streakNote.body}</p>
          </DisclosureRow>
        </ListGroup>
      </Cell>
      <Cell spec="list rows — hover (fine pointer only) · pressed --wash-2 · focus-visible (ring outside, offset 2)">
        <ListGroup title={SETTINGS.safety.title}>
          {(['hover', 'active', 'focus-visible'] as const).map(state => (
            <Force key={state} state={state}>
              <NavRow label={SETTINGS.safety.help.label} to="/help" />
            </Force>
          ))}
        </ListGroup>
      </Cell>
      <Cell spec="stacked rows: slider (value on the right) · segmented (sub line) · segmented with help">
        <div className={styles.list}>
          <StackRow label={DETAIL.slow.rate} value={PLAYER.paced.rate(rate)} hint={DETAIL.slow.rateHint}>
            {ids => (
              <Slider
                min={4.5}
                max={6.5}
                step={0.5}
                value={rate}
                onChange={setRate}
                scale={[4.5, 5, 5.5, 6, 6.5]}
                valueText={v => PLAYER.paced.rate(v)}
                labelledBy={ids.labelId}
                describedBy={ids.hintId}
              />
            )}
          </StackRow>
          <StackRow label={DETAIL.slow.ratio} hint={DETAIL.slow.ratioHint}>
            {ids => (
              <Segmented
                labelledBy={ids.labelId}
                describedBy={ids.hintId}
                value={ratio}
                onChange={setRatio}
                options={[
                  { value: 'long', label: DETAIL.slow.ratioLong(4.5, 6.5) },
                  { value: 'equal', label: DETAIL.slow.ratioEqual },
                ]}
              />
            )}
          </StackRow>
          <ToggleRow
            label={DETAIL.slow.warmup}
            hint={DETAIL.slow.warmupHint}
            checked={warm}
            onChange={setWarm}
          />
          <StackRow label={DETAIL.durationLabel}>
            {ids => (
              <Segmented
                labelledBy={ids.labelId}
                value={minutes}
                onChange={setMinutes}
                options={[3, 5, 10, 15, 20].map(m => ({
                  value: m,
                  label: String(m),
                  ...(m === 15 ? { sub: DETAIL.measureLabel } : {}),
                }))}
              />
            )}
          </StackRow>
          <StackRow label={SETTINGS.sound.cueStyle.label} hint={cue[cueStyle].help}>
            {ids => (
              <Segmented
                labelledBy={ids.labelId}
                describedBy={ids.hintId}
                value={cueStyle}
                onChange={setCueStyle}
                options={(Object.keys(cue) as (keyof typeof cue)[]).map(k => ({
                  value: k,
                  label: cue[k].name,
                }))}
              />
            )}
          </StackRow>
        </div>
      </Cell>
    </Part>
  )
}

function Controls() {
  const [seg, setSeg] = useState(5)
  const [filter, setFilter] = useState('breathing')
  const [toggle, setToggle] = useState(true)
  const [step, setStep] = useState(5)
  const [count, setCount] = useState(4)
  const [note, setNote] = useState('')
  // 计数从 180 起才显示：示例要长过 180 个字
  const long = [
    SUMMARY.note.placeholder,
    ...AFTER_PRACTICE.gentler.paragraphs,
    DETAIL.slow.rateHint,
    DETAIL.slow.warmupHint,
  ]
    .join('')
    .slice(0, 186)
  const [longNote, setLongNote] = useState(long)
  return (
    <Part id="controls" title="Native controls">
      <Cell spec="segmented — the selected cell focused (ring outside, above the neighbours) · an unselected cell focused">
        <Force state="focus-visible">
          <Segmented
            label={SETTINGS.sound.cueStyle.label}
            value="glide"
            onChange={() => {}}
            options={(['glide', 'ping', 'bed', 'off'] as const).map(k => ({
              value: k,
              label: SETTINGS.sound.cueStyle.options[k].name,
            }))}
          />
        </Force>
        <div className={styles.gap} />
        <Force state="focus-visible" index={2}>
          <Segmented
            label={DETAIL.durationLabel}
            value={seg}
            onChange={setSeg}
            options={[3, 5, 10, 15, 20].map(m => ({ value: m, label: String(m) }))}
          />
        </Force>
        <div className={styles.gap} />
        <Force state="active" index={3}>
          <Segmented
            label={DETAIL.durationLabel}
            value={seg}
            onChange={setSeg}
            options={[3, 5, 10, 15, 20].map(m => ({ value: m, label: String(m) }))}
          />
        </Force>
      </Cell>
      <Cell spec="filter row — 2 px ink rule under the current option; widths reserved for 600; current focused (inset −2)">
        <Force state="focus-visible" index={2}>
          <FilterRow
            label={EVIDENCE.title}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: EVIDENCE.filters.all },
              { value: 'meditation', label: CATEGORY_LABEL.meditation },
              { value: 'breathing', label: CATEGORY_LABEL.breathing },
              { value: 'sound', label: CATEGORY_LABEL.sound },
            ]}
          />
        </Force>
      </Cell>
      <Cell spec="toggle 51 × 31 — off · on · focus-visible · disabled off · disabled on">
        <div className={styles.row}>
          <Toggle label={SETTINGS.sound.bells.label} checked={false} onChange={() => {}} />
          <Toggle label={SETTINGS.sound.bells.label} checked={toggle} onChange={setToggle} />
          <span data-force-child="focus-visible">
            <Toggle label={SETTINGS.sound.bells.label} checked onChange={() => {}} />
          </span>
          <Toggle label={SETTINGS.sound.bells.label} checked={false} disabled onChange={() => {}} />
          <Toggle label={SETTINGS.sound.bells.label} checked disabled onChange={() => {}} />
        </div>
      </Cell>
      <Cell spec="slider — focus-visible (ring outside, offset 2) · disabled">
        <Force state="focus-visible">
          <Slider
            label={DETAIL.slow.rate}
            min={4.5}
            max={6.5}
            step={0.5}
            value={5.5}
            onChange={() => {}}
            scale={[4.5, 5, 5.5, 6, 6.5]}
            valueText={v => PLAYER.paced.rate(v)}
          />
        </Force>
        <Slider
          label={DETAIL.slow.rate}
          min={4.5}
          max={6.5}
          step={0.5}
          value={5.5}
          onChange={() => {}}
          scale={[4.5, 5, 5.5, 6, 6.5]}
          valueText={v => PLAYER.paced.rate(v)}
          disabled
        />
      </Cell>
      <Cell spec="stepper 44 — 44 | 64 | 44; end button at its limit turns --line">
        <div className={styles.row}>
          <Stepper label={SETTINGS.practice.leadIn.label} min={0} max={10} value={step} onChange={setStep} />
          <Stepper label={SETTINGS.practice.leadIn.label} min={0} max={10} value={0} onChange={() => {}} />
          <Stepper
            label={PRACTICE_BY_ID.timer.name}
            values={[1, 3, 5, 10, 15, 20, 30, 45, 60]}
            value={60}
            onChange={() => {}}
          />
        </div>
      </Cell>
      <Cell spec="stepper — + focus-visible (ring outside, offset 2) · − pressed --wash-2">
        <div className={styles.row}>
          <Force state="focus-visible" index={1}>
            <Stepper label={SETTINGS.practice.leadIn.label} min={0} max={10} value={5} onChange={() => {}} />
          </Force>
          <Force state="active" index={0}>
            <Stepper label={SETTINGS.practice.leadIn.label} min={0} max={10} value={5} onChange={() => {}} />
          </Force>
        </div>
      </Cell>
      <Cell spec="text field — placeholder · focused (2 px ink edge) · counter from 180 · error (ink, i-info, 2 px ink edge)">
        <TextField
          label={SUMMARY.note.label}
          placeholder={SUMMARY.note.placeholder}
          value={note}
          onChange={setNote}
          maxLength={200}
          multiline
        />
        <div className={styles.gap} />
        <Force state="focus-visible">
          <TextField
            labelledBy="kit-note"
            placeholder={SUMMARY.note.placeholder}
            value=""
            onChange={() => {}}
            maxLength={200}
            multiline
          />
        </Force>
        <div className={styles.gap} />
        <TextField
          labelledBy="kit-note"
          value={longNote}
          onChange={setLongNote}
          maxLength={200}
          counterFrom={180}
          multiline
        />
        <div className={styles.gap} />
        <TextField
          labelledBy="kit-note"
          value="backup.csv"
          onChange={() => {}}
          error={SETTINGS.data.import.invalid}
        />
      </Cell>
      <Cell spec="练完感觉 — no preselection, an unselected cell focused · 更紧张 selected (same ink fill as any choice)">
        <Force state="focus-visible">
          <ChoiceGroup
            label={AFTER_PRACTICE.question}
            value={null}
            onChange={() => {}}
            options={AFTER_PRACTICE.options}
          />
        </Force>
        <div className={styles.gap} />
        <ChoiceGroup
          label={AFTER_PRACTICE.question}
          value="tenser"
          onChange={() => {}}
          options={AFTER_PRACTICE.options}
        />
      </Cell>
      <Cell spec="0–10 in two rows on one 58 px pitch (57 × 48 cells), the selected 4 focused · 1–5 in one row">
        <Force state="focus-visible" index={4}>
          <ScaleGroup
            label={SUMMARY.checkin.question}
            min={0}
            max={10}
            anchors={{ low: SUMMARY.checkin.low, high: SUMMARY.checkin.high }}
            value={count}
            onChange={setCount}
          />
        </Force>
        <div className={styles.gap} />
        <ScaleGroup
          label={RECORDS.weeklyStress.question}
          min={1}
          max={5}
          anchors={{ low: RECORDS.weeklyStress.low, high: RECORDS.weeklyStress.high }}
          value={null}
          onChange={() => {}}
        />
      </Cell>
      <Cell spec="chips — 有点急 · focused · disabled · quiet · 不舒服？ (44, i-help)">
        <div className={styles.row}>
          <Chip>{PLAYER.paced.hurry}</Chip>
          <Chip data-force="focus-visible">{PLAYER.paced.hurry}</Chip>
          <Chip disabled>{PLAYER.paced.hurry}</Chip>
        </div>
        <div className={styles.row}>
          <Chip variant="quiet" icon="skip">
            {PLAYER.guided.skip}
          </Chip>
          <Chip variant="unwell">{PLAYER.unwell}</Chip>
        </div>
      </Cell>
    </Part>
  )
}

function Figures() {
  return (
    <Part id="figures" title="Figures">
      <Cell spec="week dots — phone 24/8 and desk 30/10; today cinnabar with a 10 × 1.5 rule; no mark for missed days">
        <div className={styles.row}>
          <WeekDots days={WEEK} />
          <WeekDots days={WEEK} size="desk" />
        </div>
      </Cell>
      <Cell spec="month calendar 50 × 44 cells; numeral top, 10 px dot for a practised day">
        <SectionHead
          title={RECORDS.title}
          aside={
            <span className={styles.monthNav}>
              <IconButton icon="back" label={RECORDS.prevMonth} />
              <IconButton icon="chevron-right" label={RECORDS.nextMonth} disabled />
            </span>
          }
        />
        <MonthCalendar year={2026} month={10} practised={PRACTISED} today="2026-10-22" />
        <p className={styles.caption}>{RECORDS.calendar}</p>
      </Cell>
      <Cell spec="dot plot 350 × 160 — one 8 px dot per session, today --now; no trend line">
        <DotPlot points={FOCUS_POINTS} from="2026-10-05" to="2026-10-22" label={RECORDS.focus.title} />
        <p className={styles.caption}>{RECORDS.focus.note}</p>
      </Cell>
      <Cell spec="sparkline 120 × 32 — 2 px line, 4 px dots, 8 px latest">
        <div className={styles.row}>
          <Sparkline values={[0.73, 0.81, 0.83]} label={RECORDS.count.title} />
          <span>
            <span className="pnum">83%</span>
            <Unit>{RECORDS.count.latest}</Unit>
          </span>
        </div>
        <div className={styles.row}>
          <Sparkline values={[0.62, 0.7, 0.66, 0.79, 0.86]} lastIsToday label={RECORDS.count.title} />
        </div>
      </Cell>
    </Part>
  )
}

/* ---------- 记录、阅读页和播放器里的图 ---------- */

/** 设计稿 data.mjs checkins()：19 对 */
const CHECKIN_BEFORE = [6, 7, 5, 6, 7, 6, 7, 5, 6, 5, 6, 7, 4, 5, 6, 6, 5, 6, 6]
const CHECKIN_AFTER = [5, 5, 5, 4, 5, 4, 6, 6, 4, 3, 5, 4, 3, 4, 5, 4, 4, 6, 4]
const FOCUS_MARKS = [96, 151, 188, 262, 319, 401, 478]
const dayLabel = (day: number) => `10月${day}日`
const COUNT_ROWS = [
  { date: dayLabel(14), accuracy: 0.73, resets: 2 },
  { date: dayLabel(16), accuracy: 0.81, resets: 1 },
  { date: dayLabel(18), accuracy: 0.83, resets: 0 },
  { date: dayLabel(21), accuracy: 0.42, resets: 3 },
]
const feelingLabel = (i: number) => AFTER_PRACTICE.options[i]?.label

function RecordsFigures() {
  const sessionRows = [
    {
      id: 's1',
      date: dayLabel(22),
      weekday: `周${WEEKDAYS[4]}`,
      start: '07:42',
      practice: PRACTICE_BY_ID.focus.name,
      minutes: 10,
      data: SUMMARY.marks(7),
      feeling: feelingLabel(0),
      before: 6,
      after: 4,
      note: SUMMARY.note.placeholder,
    },
    {
      id: 's2',
      date: dayLabel(21),
      weekday: `周${WEEKDAYS[3]}`,
      start: '21:05',
      practice: PRACTICE_BY_ID.slow.name,
      minutes: 5,
      data: PLAYER.paced.rate(5.5),
      feeling: feelingLabel(2),
    },
    {
      id: 's3',
      date: dayLabel(19),
      weekday: `周${WEEKDAYS[1]}`,
      start: '12:30',
      practice: PRACTICE_BY_ID['body-scan'].name,
      minutes: 15,
    },
  ]
  return (
    <Part id="records" title="Records figures">
      <Cell spec="overview — key figures in cells divided by vertical hairlines; week dots under the first">
        <Overview
          cells={[
            {
              label: RECORDS.week.title,
              figure: 3,
              unit: RECORDS.dayUnit,
              note: RECORDS.totalMinutes(46),
              children: <WeekDots days={WEEK} />,
            },
            {
              label: RECORDS.month.replace('{month}', '10'),
              figure: 19,
              unit: RECORDS.dayUnit,
              note: (
                <>
                  {RECORDS.sessions(26)}
                  <br />
                  {RECORDS.totalMinutes(238)}
                </>
              ),
            },
          ]}
        />
      </Cell>
      <Cell spec="practice bars — name 112 | 6 px ink-2 bar (min 3, rounded data end) | 「150 分钟 · 15 次」 128">
        <PracticeBars
          rows={[
            { name: PRACTICE_BY_ID.slow.name, minutes: 150, sessions: 15 },
            { name: PRACTICE_BY_ID.focus.name, minutes: 95, sessions: 9 },
            { name: PRACTICE_BY_ID['body-scan'].name, minutes: 60, sessions: 4 },
            { name: PRACTICE_BY_ID.pause.name, minutes: 3, sessions: 3 },
          ]}
        />
      </Cell>
      <Cell spec="check-in strips — two rows on one 0–10 axis, clusters three dots wide, 1.5 px median rules">
        <CheckinStrips before={CHECKIN_BEFORE} after={CHECKIN_AFTER} />
      </Cell>
      <Cell spec="count rows — desk: date | accuracy dot on a 50–100 % track | % | resets (42 % clamps to the 50 end) · phone: no dots">
        <CountRows rows={COUNT_ROWS} />
        <div className={styles.gap} />
        <CountRows rows={COUNT_ROWS} dots={false} />
      </Cell>
      <Cell
        spec="sessions table (desktop) — head over a 1 px ink rule; 44 rows; 详情 · 删除 on hover and focus-within; row 2 hovered, row 3 focused"
        full
      >
        <div className={styles.scroller}>
          <Force state="hover" index={1} selector="tbody tr">
            <Force state="focus-visible" index={4}>
              <SessionsTable
                rows={sessionRows}
                onOpen={() => {}}
                onDelete={() => {}}
                more={{ label: RECORDS.list.showEarlier(50), onMore: () => {} }}
                className={styles.table}
              />
            </Force>
          </Force>
        </div>
      </Cell>
    </Part>
  )
}

function ReadingFigures() {
  const slow = PRACTICE_BY_ID.slow
  const cites = slow.evidence
  return (
    <Part id="reading" title="Reading page figures · steps · claims">
      <Cell spec="breath specimen — 3 steady cycles at the defaults, 1 s ticks, 5 s grid, 10 s labels, unit on the last; brackets name each phase; 图 1 caption phrase-wrapped">
        {slow.paced && (
          <Figure number={1} caption={DETAIL.figureCaption.slow}>
            <BreathSpecimen params={slow.paced} />
          </Figure>
        )}
      </Cell>
      <Cell spec="specimens — cyclic sigh (one cycle) · box (one cycle)">
        {PRACTICE_BY_ID['cyclic-sigh'].paced && (
          <Figure number={1} caption={DETAIL.figureCaption['cyclic-sigh']}>
            <BreathSpecimen params={PRACTICE_BY_ID['cyclic-sigh'].paced} cycles={1} />
          </Figure>
        )}
        <div className={styles.gap} />
        {PRACTICE_BY_ID.box.paced && (
          <Figure number={1} caption={DETAIL.figureCaption.box}>
            <BreathSpecimen params={PRACTICE_BY_ID.box.paced} cycles={1} />
          </Figure>
        )}
      </Cell>
      <Cell spec="steps — 01 02 03 caption tabular ink-3 in a 1.875em column; hairlines between">
        <Steps items={slow.steps} />
      </Cell>
      <Cell spec="claims — one graded result per line (reading 17/28 600), note numerals before the final stop; scope caption">
        <Claims
          claims={slow.evidenceClaims.map(c => ({
            claim: c.claim,
            grade: c.grade,
            cites: c.cites.map(id => cites.indexOf(id) + 1).filter(k => k > 0),
          }))}
          scope={EVIDENCE.grades.scope}
        />
      </Cell>
    </Part>
  )
}

function PlayerFigures() {
  const scan = stepSections(buildTimeline(getScript('body-scan'), 10, { level: 'standard' }), TODAY.start)
  const space = stepSections(
    buildTimeline(getScript('breathing-space'), 3, { level: 'standard' }),
    TODAY.start,
  )
  return (
    <Part id="player" title="Player figures · readouts">
      <Cell spec="step chart — player (6 px steps, now = 372 s: past ink-2, current ink to now, future --line, cinnabar now)">
        <StepChart sections={scan} duration={600} now={372} name={PRACTICE_BY_ID['body-scan'].name} />
      </Cell>
      <Cell spec="step chart — 今日 (5 px steps, no now) · 左腿 skipped (dashed 2 / 4)">
        <StepChart sections={scan} duration={600} step={5} name={PRACTICE_BY_ID['body-scan'].name} />
        <div className={styles.gap} />
        <StepChart
          sections={scan}
          duration={600}
          now={300}
          skipped={['left-leg']}
          name={PRACTICE_BY_ID['body-scan'].name}
        />
      </Cell>
      <Cell spec="section strip — every other guided practice: all treads on one level">
        <SectionStrip
          sections={space}
          duration={180}
          now={70}
          name={PRACTICE_BY_ID['breathing-space'].name}
        />
      </Cell>
      <Cell spec="focus timeline — player (t = 412: dotted future, cinnabar now) · summary (whole session past)">
        <FocusTimeline minutes={10} marks={FOCUS_MARKS.filter(m => m <= 412)} t={412} />
        <div className={styles.gap} />
        <FocusTimeline minutes={10} marks={FOCUS_MARKS} />
      </Cell>
      <Cell
        spec="the same figures in a wider column (player on tablet and desktop: 640) — geometry recomputed, labels stay 11 px"
        wide
      >
        <FocusTimeline minutes={15} marks={FOCUS_MARKS} t={540} />
        <div className={styles.gap} />
        <StepChart sections={scan} duration={600} now={372} name={PRACTICE_BY_ID['body-scan'].name} />
      </Cell>
      <Cell spec="readouts — paced 剩余 · 节律 · 轮数 · guided (下一处 as text 17/32) · focus 剩余 only">
        <Readouts
          items={[
            { label: PLAYER.readouts.left, value: '06:15' },
            { label: PLAYER.readouts.rate, value: '5.5', unit: PLAYER.paced.rate(5.5).split(' ')[1] },
            { label: PLAYER.readouts.rounds, value: '23' },
          ]}
        />
        <Readouts
          items={[
            { label: PLAYER.readouts.left, value: '03:48' },
            { label: PLAYER.guided.sectionLeft, value: '00:41' },
            { label: PLAYER.readouts.next, value: stepLabel(scan[6]?.title ?? ''), text: true },
          ]}
        />
        <Readouts items={[{ label: PLAYER.readouts.left, value: '05:48' }]} />
      </Cell>
      <Cell spec="spec strip (summary) — the same cells between two hairlines">
        <Readouts
          variant="spec"
          items={[
            { label: RECORDS.duration, value: '10', unit: TODAY.minutes(10).split(' ')[1] },
            { label: PLAYER.focus.mark, value: '7', unit: timesText(7).split(' ')[1] },
          ]}
        />
      </Cell>
    </Part>
  )
}

/** 内容里的一张证据卡片 → EvidenceCard 的各栏（证据页的工程师会写同样的映射；这里只为看样子） */
function evidenceFields(card: EvidenceCardData): EvidenceField[] {
  const cite = (id: string) => {
    const c = EVIDENCE_CITES[id]
    return c ? <SourceLine cite={citeLine(c)} href={citeHref(c)} label={citeLabel(c)} /> : null
  }
  const fields: EvidenceField[] = []
  const outcomes = card.outcomes ?? []
  if (outcomes.length > 0) {
    const axis = effectAxis(outcomes)
    fields.push({
      term: EVIDENCE.card.effect,
      wide: true,
      content: (
        <EffectRows
          domain={[axis.min, axis.max]}
          ticks={axis.ticks}
          note={effectNote(card)}
          outcomes={outcomes.map(o => ({
            name: o.name,
            detail: formatSize(o, card.unit),
            value: formatEffect(o, card.metric),
            ci: { g: o.g, lo: o.lo, hi: o.hi },
          }))}
        />
      ),
    })
  } else if (card.stat) {
    fields.push({ term: EVIDENCE.card.effect, content: card.stat })
  }
  fields.push({ term: EVIDENCE.card.design, content: card.design })
  fields.push({
    term: EVIDENCE.card.grade,
    content: (
      <>
        <GradeMark grade={card.grade} />
        <p>{EVIDENCE.grades.definitions[card.grade]}</p>
      </>
    ),
  })
  fields.push({ term: EVIDENCE.card.limits, content: card.limits })
  for (const c of card.contrary) {
    fields.push({
      term: EVIDENCE.card.contrary,
      content: (
        <>
          <p>{c.text}</p>
          {cite(c.claimId)}
        </>
      ),
    })
  }
  fields.push({ term: EVIDENCE.card.source, content: cite(card.source) })
  return fields
}

function Evidence() {
  const [open, setOpen] = useState<string | null>(null)
  const [discl, setDiscl] = useState(false)
  const breathing = EVIDENCE_CARDS.filter(c => c.category === 'breathing')
  const [full, ...rest] = breathing
  const slow = PRACTICE_BY_ID.slow
  return (
    <Part id="evidence" title="Evidence · citations">
      <Cell spec="citation numerals (Inter micro, raised 0.55em) · notes · DOI link (24 line, 44 target)">
        <p className="t-reading">
          {slow.short}
          <Cite n={1} />
          <Cite n={2} />。
        </p>
        <Notes
          items={[
            {
              who: 'Shaffer & Meehan 2020',
              type: CATEGORY_LABEL.breathing,
              what: slow.evidenceSummary,
              venue: 'Frontiers in Neuroscience',
              doi: '10.3389/fnins.2020.570400',
            },
            {
              who: 'Fincham 2023',
              type: EVIDENCE.card.design,
              venue: 'Scientific Reports',
              doi: '10.1038/s41598-023-49279-8',
            },
          ]}
        />
      </Cell>
      {full && (
        <Cell
          spec="evidence card (full): kicker → claim → effect + CI on one shared axis → fields (PRODUCT.md §9)"
          wide
        >
          <EvidenceCard
            topic={full.topic}
            grade={full.grade}
            claim={full.claim}
            fields={evidenceFields(full)}
          />
        </Cell>
      )}
      <Cell spec="evidence cards (collapsed): claim 15/24 600 + meta line + 展开 disclosure" wide>
        <div className={styles.cards}>
          {rest.slice(0, 2).map(card => (
            <EvidenceCard
              key={card.id}
              topic={card.topic}
              grade={card.grade}
              claim={card.claim}
              meta={metaLine(card)}
              expanded={open === card.id}
              onToggle={() => setOpen(o => (o === card.id ? null : card.id))}
              fields={evidenceFields(card)}
            />
          ))}
        </div>
      </Cell>
      <Cell spec="disclosure — chevron turns 180° in 240 ms">
        <Disclosure expanded={discl} controls="kit-reveal" onToggle={() => setDiscl(d => !d)}>
          {RECORDS.streakNote.title}
        </Disclosure>
        <Reveal id="kit-reveal" expanded={discl}>
          <p className={styles.reveal}>{RECORDS.streakNote.body}</p>
        </Reveal>
      </Cell>
    </Part>
  )
}

function Help() {
  return (
    <Part id="help" title="Help numbers">
      <Cell spec="emergency line: body in ink, phrase-wrapped, 120 a tel: link (Inter 600, underlined)">
        <EmergencyLine text={STOP_GUIDANCE.emergency} />
      </Cell>
      <Cell spec="dial grid — ruled 2 × 2, 64 high cells; 急救 120 focused (ring outside the cell)">
        <Force state="focus-visible" index={2}>
          <DialGrid lines={mainland} />
        </Force>
      </Cell>
      <Cell spec="phone rows — whole row is a tel: link">
        <div className={styles.list}>
          {mainland.slice(0, 2).map(line => (
            <PhoneRow key={line.href} line={line} />
          ))}
        </div>
      </Cell>
      <Cell spec="empty state — left-aligned, no illustration">
        <EmptyState
          title={RECORDS.empty.title}
          body={RECORDS.empty.body}
          action={<LinkMore to="/practices">{RECORDS.goPractice}</LinkMore>}
        />
      </Cell>
    </Part>
  )
}

function Overlays() {
  const [sheet, setSheet] = useState<'app' | 'player' | 'first-run' | null>(
    openOverlay === 'sheet'
      ? 'app'
      : openOverlay === 'sheet-player'
        ? 'player'
        : openOverlay === 'sheet-first-run'
          ? 'first-run'
          : null,
  )
  const [dialog, setDialog] = useState(openOverlay === 'dialog')
  const toast = useToast()
  useEffect(() => {
    if (openOverlay === 'toast')
      toast.show({
        message: PLAYER.notices.audioBlocked,
        action: { label: PLAYER.notices.audioRetry, onAction: () => {} },
      })
  }, [toast])
  return (
    <Part id="overlays" title="Sheet · dialog · toast">
      <Cell spec="open the overlays (also ?open=sheet | sheet-player | sheet-first-run | dialog | toast)">
        <div className={styles.row}>
          <Button onClick={() => setSheet('app')}>{TODAY.hard.title}</Button>
          <Button onClick={() => setSheet('player')}>{PLAYER.unwell}</Button>
          <Button onClick={() => setSheet('first-run')}>{FIRST_RUN_NOTICE.title}</Button>
          <Button variant="danger" onClick={() => setDialog(true)}>
            {RECORDS.list.delete}
          </Button>
          <Button variant="quiet" onClick={() => toast.show({ message: SETTINGS.data.deleteAll.done })}>
            Toast
          </Button>
        </div>
      </Cell>
      <Sheet
        open={sheet === 'app'}
        onClose={() => setSheet(null)}
        title={TODAY.hard.title}
        closeButton
        footer={<Button onClick={() => setSheet(null)}>{SETTINGS.data.deleteAll.first.cancel}</Button>}
      >
        <p className={styles.sheetIntro}>{TODAY.hard.intro}</p>
        <PracticeList>
          {QUICK_PICKS.map(q => (
            <PracticeRow
              key={q.practiceId}
              practice={PRACTICE_BY_ID[q.practiceId as keyof typeof PRACTICE_BY_ID]}
              name={q.label}
              description={q.hint}
              minutes={q.minutes}
              to={`/play/${q.practiceId}`}
            />
          ))}
        </PracticeList>
        <SectionHead title={TODAY.hard.help.label} aside={CRISIS_CARD.verified} />
        <DialGrid lines={mainland} />
      </Sheet>
      <Sheet
        open={sheet === 'player'}
        onClose={() => setSheet(null)}
        title={PLAYER.unwell}
        surface="player"
        size="full"
        footer={
          <>
            <Button onClick={() => setSheet(null)}>{PLAYER.unwellSheet.endPractice}</Button>
            <Button variant="quiet" onClick={() => setSheet(null)}>
              {PLAYER.resume}
            </Button>
          </>
        }
      >
        <p className={styles.sheetIntro}>{STOP_GUIDANCE.short}</p>
        <EmergencyLine text={STOP_GUIDANCE.emergency} />
        <div className={styles.gap} />
        <Button variant="primary" block>
          {STOP_GUIDANCE.actions.grounding}
        </Button>
        <div className={styles.gap} />
        <SectionHead title={TODAY.hard.help.label} />
        <DialGrid lines={mainland} />
      </Sheet>
      <Sheet
        open={sheet === 'first-run'}
        onClose={() => setSheet(null)}
        title={FIRST_RUN_NOTICE.title}
        size="full"
        wide
        dismissible={false}
        footer={
          <div className={styles.firstRunFoot}>
            <p className={styles.caption}>{FIRST_RUN_NOTICE.readToEnd}</p>
            <Button variant="primary" block onClick={() => setSheet(null)}>
              {FIRST_RUN_NOTICE.confirm}
            </Button>
          </div>
        }
      >
        {FIRST_RUN_NOTICE.sections.map((section, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 须知的段落顺序固定
          <div key={i} className={styles.sheetIntro}>
            {section.heading && <h3 className="t-name">{section.heading}</h3>}
            {section.paragraphs?.map(text => (
              <p key={text}>{text}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map(text => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Sheet>
      <ConfirmDialog
        open={dialog}
        title={RECORDS.list.confirmDelete.split('？')[0]?.concat('？') ?? ''}
        body={RECORDS.list.confirmDelete.split('？')[1]}
        confirmLabel={RECORDS.list.delete}
        cancelLabel={SETTINGS.data.deleteAll.first.cancel}
        tone="danger"
        onConfirm={() => setDialog(false)}
        onCancel={() => setDialog(false)}
      />
    </Part>
  )
}

function Board({ theme }: { theme: Theme }) {
  return (
    <div className={styles.board} data-theme={theme}>
      <h1 className={styles.boardTitle}>{theme === 'light' ? 'Light · 纸' : 'Dark · 墨'}</h1>
      <Type />
      <Icons />
      <Buttons />
      <Heads />
      <Rows />
      <Lists />
      <Controls />
      <Figures />
      <RecordsFigures />
      <ReadingFigures />
      <PlayerFigures />
      <Evidence />
      <Help />
      {theme === (onlyTheme ?? 'light') && <Overlays />}
    </div>
  )
}

function Kit() {
  const themes: Theme[] = onlyTheme ? [onlyTheme] : ['light', 'dark']
  useEffect(installForcedStates, [])
  return (
    <MemoryRouter>
      <ToastHost>
        <main className={onlyTheme ? styles.single : styles.kit}>
          {themes.map(t => (
            <Board key={t} theme={t} />
          ))}
        </main>
      </ToastHost>
    </MemoryRouter>
  )
}

const root = document.getElementById('root')
if (root) {
  if (onlyTheme) document.documentElement.dataset.theme = onlyTheme
  createRoot(root).render(
    <StrictMode>
      <Kit />
    </StrictMode>,
  )
}
