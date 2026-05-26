import type {WorkbenchMode} from '../types/tab'

export type WorkbenchCommandSurface =
  | 'modebar'
  | 'topbar'
  | 'bottombar'
  | 'editbar'
  | 'library'
  | 'keyboard'

export type WorkbenchCommandOwner =
  | 'workbenchFlowService'
  | 'workbenchTabService'
  | 'legacyTrainingFlowController'
  | 'scratchEditInteractionExecutor'
  | 'taskImportService'
  | 'reviewService'
  | 'sabakiAdapter'

export type WorkbenchCommand = {
  id: string
  surface: WorkbenchCommandSurface
  modes: WorkbenchMode[] | 'any'
  label: string
  owner: WorkbenchCommandOwner
  handlerProp: string
  disabledReason: string
  testId?: string
  key?: string
}

export const WORKBENCH_COMMANDS: WorkbenchCommand[] = [
  {
    id: 'mode.enter-analysis',
    surface: 'modebar',
    modes: ['play', 'problem', 'recall'],
    label: '复盘模式',
    owner: 'workbenchFlowService',
    handlerProp: 'onAnalysis',
    disabledReason: '当前状态不能进入复盘',
    testId: 'mode-action-analysis',
  },
  {
    id: 'mode.return-from-analysis',
    surface: 'modebar',
    modes: ['analysis'],
    label: '返回上一个模式',
    owner: 'workbenchFlowService',
    handlerProp: 'onModeChange',
    disabledReason: '请先返回上一个模式',
    testId: 'mode-action-return',
  },
  {
    id: 'problem.submit',
    surface: 'topbar',
    modes: ['problem'],
    label: '提交',
    owner: 'workbenchFlowService',
    handlerProp: 'onSubmit',
    disabledReason: '当前没有可提交的作答',
    testId: 'mode-action-submit',
  },
  {
    id: 'problem.abandon',
    surface: 'topbar',
    modes: ['problem'],
    label: '放弃',
    owner: 'workbenchFlowService',
    handlerProp: 'onAbandon',
    disabledReason: '当前没有进行中的题目',
    testId: 'mode-action-abandon',
  },
  {
    id: 'recall.finish',
    surface: 'topbar',
    modes: ['recall'],
    label: '完成回忆',
    owner: 'workbenchFlowService',
    handlerProp: 'onEnd',
    disabledReason: '当前没有可结束的 RecallSession',
    testId: 'mode-action-end',
  },
  {
    id: 'analysis.snapshot',
    surface: 'topbar',
    modes: ['analysis'],
    label: 'Snapshot 出题',
    owner: 'workbenchFlowService',
    handlerProp: 'onSnapshot',
    disabledReason: '当前局面不可捕获',
    testId: 'mode-action-snapshot',
  },
  {
    id: 'analysis.return',
    surface: 'topbar',
    modes: ['analysis'],
    label: '返回',
    owner: 'workbenchFlowService',
    handlerProp: 'onReturn',
    disabledReason: '没有可返回的 AnalysisReturnTarget',
    testId: 'mode-action-return',
  },
  {
    id: 'play.new-game',
    surface: 'topbar',
    modes: ['play'],
    label: '新对局',
    owner: 'workbenchTabService',
    handlerProp: 'onNewGame',
    disabledReason: '当前不能创建新对局',
    testId: 'mode-action-new-game',
  },
  {
    id: 'play.resign',
    surface: 'topbar',
    modes: ['play'],
    label: '认输',
    owner: 'sabakiAdapter',
    handlerProp: 'onResign',
    disabledReason: '当前没有可认输的对局',
    testId: 'mode-action-resign',
  },
  {
    id: 'bottom.undo',
    surface: 'bottombar',
    modes: 'any',
    label: '悔棋',
    owner: 'sabakiAdapter',
    handlerProp: 'onUndo',
    disabledReason: '当前没有可撤销操作',
  },
  {
    id: 'bottom.hint',
    surface: 'bottombar',
    modes: ['problem', 'recall'],
    label: '提示',
    owner: 'legacyTrainingFlowController',
    handlerProp: 'onRequestHint',
    disabledReason: '当前没有可用提示',
  },
  {
    id: 'editbar.tool',
    surface: 'editbar',
    modes: ['analysis'],
    label: '箭头',
    owner: 'scratchEditInteractionExecutor',
    handlerProp: 'onAnnotationToolChange',
    disabledReason: '未进入 Analysis scratch 局面',
  },
  {
    id: 'editbar.edit-position',
    surface: 'editbar',
    modes: ['analysis'],
    label: 'Edit Position',
    owner: 'scratchEditInteractionExecutor',
    handlerProp: 'onEditPosition',
    disabledReason: '当前局面不可编辑',
  },
  {
    id: 'editbar.clear',
    surface: 'editbar',
    modes: ['analysis'],
    label: '清除',
    owner: 'scratchEditInteractionExecutor',
    handlerProp: 'onClear',
    disabledReason: '当前 scratch 局面没有可清除内容',
    testId: 'action-clear',
  },
  {
    id: 'library.open',
    surface: 'library',
    modes: 'any',
    label: '资料库',
    owner: 'workbenchTabService',
    handlerProp: 'onOpenGameLibrary',
    disabledReason: '资料库不可用',
  },
  {
    id: 'library.history',
    surface: 'library',
    modes: 'any',
    label: '历史记录',
    owner: 'workbenchTabService',
    handlerProp: 'onSwitchLibraryDrawer',
    disabledReason: '历史记录不可用',
  },
  {
    id: 'library.kifu',
    surface: 'library',
    modes: 'any',
    label: '棋谱库',
    owner: 'taskImportService',
    handlerProp: 'onSwitchLibraryDrawer',
    disabledReason: '棋谱库不可用',
  },
  {
    id: 'library.game-records',
    surface: 'library',
    modes: 'any',
    label: '对局库',
    owner: 'workbenchTabService',
    handlerProp: 'onSwitchLibraryDrawer',
    disabledReason: '对局库不可用',
  },
  {
    id: 'library.fox',
    surface: 'library',
    modes: 'any',
    label: '野狐对局',
    owner: 'taskImportService',
    handlerProp: 'onOpenFoxGames',
    disabledReason: '野狐账号未配置或同步失败',
  },
  {
    id: 'library.101',
    surface: 'library',
    modes: 'any',
    label: '101 错题',
    owner: 'taskImportService',
    handlerProp: 'onOpenOneOhOneWeiqi',
    disabledReason: '101 会话无效或同步失败',
  },
  {
    id: 'keyboard.snapshot',
    surface: 'keyboard',
    modes: 'any',
    label: 'S',
    owner: 'workbenchFlowService',
    handlerProp: 'onSnapshot',
    disabledReason: '当前局面不可捕获',
    key: 'S',
  },
]

export function listWorkbenchCommands(): WorkbenchCommand[] {
  return [...WORKBENCH_COMMANDS]
}

export function findWorkbenchCommand(id: string): WorkbenchCommand | undefined {
  return WORKBENCH_COMMANDS.find(command => command.id === id)
}
