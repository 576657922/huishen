/**
 * 练习的流程：开始、练习前自评、「不舒服？」的出口、结束与小结。
 * 页面和小组件只调这里的函数，不直接拼会话控制器、记录仓库和偏好。
 */
export {
  continueAfterDistress,
  endFromDistress,
  pauseForDistress,
  startGroundingFromDistress,
} from './distress'
export {
  abandonPractice,
  closeSummary,
  ENDING_HOLD_MS,
  endForHandoff,
  initFlows,
  NOTE_MAX,
  submitCheckin,
  submitFeeling,
  submitNote,
} from './finish'
export { savePaceFinderRun } from './paceFinder'
export { latestRecords, unwellJustBefore, watchRecords } from './records'
export { cancelResume, resumeAfterLeadIn } from './resume'
export { changeSessionSound, rememberSound, setCueVolume } from './sound'
export {
  answerPreCheckin,
  CHECKIN_SEEN_MS,
  confirmSafetyNotice,
  needsPreCheckin,
  practiceAgain,
  type StartOutcome,
  startPractice,
} from './start'
export {
  INITIAL_SESSION,
  type PendingSession,
  type ProgramDayRef,
  type SessionPhase,
  type SessionSummary,
  type StartOptions,
  type StartSource,
  type SummaryAnswers,
  sessionStore,
  usePendingSession,
} from './store'
