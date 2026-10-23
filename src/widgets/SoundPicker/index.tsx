/**
 * 选背景声（PRODUCT.md §2、DESIGN.md §13.4、§13.9、§8.15.15）：声景一层（自然声、噪声，选一个就换掉另一个）
 * 和音乐一层可以叠加，各有音量。睡前模式按 sounds.ts 的规则不列鸟鸣。受控组件：存到哪里由页面决定
 * （详情页和播放器用 rememberSound / changeSessionSound，设置页写 prefs.sounds）。
 * 试听：点选一个声音时在这次点击里试听几秒（练习中不试听，声音面板直接换）。
 */
import { useEffect, useId, useRef } from 'react'
import { getAudio, peekAudio } from '@/app/services'
import type { AmbienceId, MusicId, SoundMix, SoundMode } from '@/audio/types'
import { SETTINGS } from '@/content/copy'
import { type AnySound, NONE, SOUND_GROUPS, soundsFor } from '@/content/sounds'
import { GroupTitle, Icon, Segmented, Slider, StackRow, useRadioGroup } from '@/ui'
import styles from './SoundPicker.module.css'

export interface SoundPickerProps {
  /** 当前的组合：声景、音乐和两路音量 */
  value: SoundMix
  onChange: (mix: SoundMix) => void
  /** 放松或睡前：睡前不列鸟鸣 */
  mode: SoundMode
  /** 给了就在最上面放「放松 · 睡前」分段控件（设置 › 默认背景声） */
  onModeChange?: (mode: SoundMode) => void
  /** 点选声音时试听几秒；练习中的声音面板不要开 */
  preview?: boolean
  /** 声景、音乐两条音量滑块 */
  volumes?: boolean
  /** 组标题的级别 */
  level?: 2 | 3
  className?: string
}

/** 声景这一层的读屏名称 TODO(content) */
const AMBIENCE_LABEL = '声景'

const MODES: readonly SoundMode[] = ['relax', 'sleep']

/** 音量的读数：滑块行在右边印出当前值（DESIGN.md §8.7），百分号不留空格（§4.4） */
const percent = (v: number): string => `${Math.round(v)}%`

interface Option<Id> {
  id: Id
  name: string
  tag: string | null
  sound: AnySound | null
}

const noneOption = <Id extends string>(id: Id): Option<Id> => ({
  id,
  name: NONE.name,
  tag: null,
  sound: null,
})
const toOption = <Id extends string>(s: AnySound & { id: Id }): Option<Id> => ({
  id: s.id,
  name: s.name,
  tag: s.tag,
  sound: s,
})

interface RadioListProps<Id extends string> {
  label: string
  /** 分组：每组一个可选的标题，标题之下一串行 */
  groups: readonly { title?: string; options: readonly Option<Id>[] }[]
  value: Id
  onSelect: (id: Id) => void
  level: 2 | 3
}

/** 一组单选行：整行可点，图标、名称、标注，选中的行尾有 ✓；方向键在行间移动并选中 */
function RadioList<Id extends string>({ label, groups, value, onSelect, level }: RadioListProps<Id>) {
  const all = groups.flatMap(g => g.options)
  const radio = useRadioGroup({ values: all.map(o => o.id), value, onChange: onSelect, selectOnMove: true })
  let index = 0
  return (
    <div role="radiogroup" aria-label={label}>
      {groups.map(group => (
        <div key={group.title ?? 'none'}>
          {group.title && <GroupTitle level={level}>{group.title}</GroupTitle>}
          <div className={styles.list}>
            {group.options.map(option => {
              const i = index++
              const checked = option.id === value
              return (
                // biome-ignore lint/a11y/useSemanticElements: 整行可点的单选按 APG radio group 用 button + role="radio"、漫游焦点实现
                <button
                  key={option.id}
                  ref={radio.ref(i)}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={radio.tabIndex(i)}
                  onKeyDown={radio.onKeyDown(i)}
                  onFocus={radio.onFocus(i)}
                  onClick={() => onSelect(option.id)}
                  className={styles.row}
                >
                  <span className={styles.icon}>
                    {option.sound && <Icon name={option.sound.icon} size={20} />}
                  </span>
                  <span className={styles.label}>
                    {option.name}
                    {option.tag && <span className={styles.tag}>{option.tag}</span>}
                  </span>
                  {checked && <Icon name="check" size={16} className={styles.check} />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SoundPicker({
  value,
  onChange,
  mode,
  onModeChange,
  preview = false,
  volumes = false,
  level = 3,
  className,
}: SoundPickerProps) {
  const lists = soundsFor(mode)
  const modeLabelId = useId()
  const previewing = useRef(false)

  // 离开时停掉还在响的试听
  useEffect(
    () => () => {
      if (previewing.current) peekAudio()?.stopPreview()
    },
    [],
  )

  const choose = (next: SoundMix): void => {
    onChange(next)
    if (!preview) return
    previewing.current = true
    getAudio().preview({ ...next, mode })
  }

  const setVolume = (key: 'ambienceVolume' | 'musicVolume', volume: number): void => {
    onChange({ ...value, [key]: volume })
    if (previewing.current) peekAudio()?.setVolume(key === 'ambienceVolume' ? 'ambience' : 'music', volume)
  }

  const ambienceGroups = [
    {
      title: SOUND_GROUPS.nature.name,
      options: [noneOption<AmbienceId>('none'), ...lists.nature.map(toOption)],
    },
    { title: SOUND_GROUPS.noise.name, options: lists.noise.map(toOption) },
  ]
  const musicGroups = [
    { title: SOUND_GROUPS.music.name, options: [noneOption<MusicId>('none'), ...lists.music.map(toOption)] },
  ]

  return (
    <div className={className}>
      {onModeChange && (
        <div className={styles.mode}>
          <span id={modeLabelId} className="vh">
            {SETTINGS.sound.defaults.label}
          </span>
          <Segmented
            options={MODES.map(m => ({ value: m, label: SETTINGS.sound.mode[m] }))}
            value={mode}
            onChange={onModeChange}
            labelledBy={modeLabelId}
          />
        </div>
      )}
      <RadioList
        label={AMBIENCE_LABEL}
        groups={ambienceGroups}
        value={value.ambience}
        onSelect={ambience => choose({ ...value, ambience })}
        level={level}
      />
      {volumes && (
        <StackRow
          label={SETTINGS.sound.volume.ambience}
          value={percent(value.ambienceVolume)}
          className={styles.volume}
        >
          {ids => (
            <Slider
              min={0}
              max={100}
              step={5}
              majorStep={25}
              value={value.ambienceVolume}
              valueText={percent}
              onChange={v => setVolume('ambienceVolume', v)}
              labelledBy={ids.labelId}
            />
          )}
        </StackRow>
      )}
      <RadioList
        label={SOUND_GROUPS.music.name}
        groups={musicGroups}
        value={value.music}
        onSelect={music => choose({ ...value, music })}
        level={level}
      />
      {volumes && (
        <StackRow
          label={SETTINGS.sound.volume.music}
          value={percent(value.musicVolume)}
          className={styles.volume}
        >
          {ids => (
            <Slider
              min={0}
              max={100}
              step={5}
              majorStep={25}
              value={value.musicVolume}
              valueText={percent}
              onChange={v => setVolume('musicVolume', v)}
              labelledBy={ids.labelId}
            />
          )}
        </StackRow>
      )}
    </div>
  )
}
