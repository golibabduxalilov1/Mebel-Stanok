import { ToirTaskType } from './types';

export interface ToirCategoryConfig {
  type: ToirTaskType;
  code: string;
  title: string;
  shortName: string;
  badgeLabel: string;
  goal: string;
  description: string;
  examples: string[];
  colorClasses: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    chipActive: string;
    iconBg: string;
    iconText: string;
    glow: string;
  };
}

export const TOIR_CATEGORIES: Record<ToirTaskType, ToirCategoryConfig> = {
  routine: {
    type: 'routine',
    code: 'EO_TO',
    title: 'Регламентные задачи (ЕО и ТО)',
    shortName: 'Общее ТО',
    badgeLabel: 'Регламент (ЕО/ТО)',
    goal: 'Предотвращение износа и поддержание станка в рабочем состоянии.',
    description: 'Ежесменное (ЕО) и периодическое техобслуживание по наработке моточасов/дней.',
    examples: [
      'Ежедневная очистка направляющих и защитных кожухов',
      'Проверка и доливка уровней масел и давления в пневмосистеме',
      'Смазка ШВП и линейных кареток (консистентная смазка)',
      'Замена масляных и воздушных фильтров по графику наработки',
      'Очистка стружкосборника, сетки помпы и бака СОЖ',
      'Проверка концентрации и замена СОЖ'
    ],
    colorClasses: {
      bg: 'bg-emerald-50/70',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      chipActive: 'bg-emerald-600 text-white shadow-emerald-200',
      iconBg: 'bg-emerald-500 text-white',
      iconText: 'text-emerald-600',
      glow: 'shadow-emerald-100'
    }
  },
  diagnostic: {
    type: 'diagnostic',
    code: 'DIAG',
    title: 'Диагностические и контрольно-измерительные задачи',
    shortName: 'Диагностика',
    badgeLabel: 'Диагностика & КИП',
    goal: 'Оценка текущего состояния узлов и поиск скрытых дефектов до аварии.',
    examples: [
      'Проверка геометрической точности станка и плоскостности стола',
      'Измерение радиального и осевого биения шпинделя (индикатором)',
      'Контроль люфтов и мертвого хода по осям X / Y / Z',
      'Тепловизионный осмотр электрошкафа, клеммников и пускателей',
      'Вибродиагностика подшипниковых узлов шпинделя и сервомоторов',
      'Проверка усилия зажима инструмента в шпинделе'
    ],
    description: 'Инструментальный контроль параметров точности, температуры, вибрации и износа.',
    colorClasses: {
      bg: 'bg-indigo-50/70',
      border: 'border-indigo-200',
      text: 'text-indigo-900',
      badgeBg: 'bg-indigo-100 text-indigo-800',
      badgeText: 'text-indigo-800',
      badgeBorder: 'border-indigo-300',
      chipActive: 'bg-indigo-600 text-white shadow-indigo-200',
      iconBg: 'bg-indigo-500 text-white',
      iconText: 'text-indigo-600',
      glow: 'shadow-indigo-100'
    }
  },
  ppr: {
    type: 'ppr',
    code: 'PPR',
    title: 'Планово-предупредительные ремонтные задачи (ППР)',
    shortName: 'Ремонт',
    badgeLabel: 'ППР (Плановый ремонт)',
    goal: 'Восстановление ресурсных характеристик оборудования.',
    examples: [
      'Плановая замена радиально-упорных опорных подшипников ШВП',
      'Переборка, чистка и юстировка позиционирования револьверной головки',
      'Замена изношенных РВД (рукавов высокого давления) гидростанции',
      'Шабровка и регулировка клиньев и планок направляющих',
      'Замена зубчатых приводных ремней и натяжных роликов',
      'Замена уплотнений, манжет и грязесъемников гидроцилиндров'
    ],
    description: 'Средний и текущий плановый ремонт с заменой выработавших ресурс узлов.',
    colorClasses: {
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badgeBg: 'bg-amber-100 text-amber-800',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-300',
      chipActive: 'bg-amber-600 text-white shadow-amber-200',
      iconBg: 'bg-amber-500 text-white',
      iconText: 'text-amber-600',
      glow: 'shadow-amber-100'
    }
  },
  emergency: {
    type: 'emergency',
    code: 'AVAR',
    title: 'Аварийно-восстановительные задачи (Внеплановый ремонт)',
    shortName: 'Аварийный ремонт',
    badgeLabel: 'Аварийный ремонт',
    goal: 'Оперативное устранение внезапных поломок и сбоев.',
    examples: [
      'Поиск причин и сброс критических ошибок ЧПУ (Alarm / Fault)',
      'Замена сгоревших плат ЧПУ, сервоусилителей или блоков питания',
      'Устранение механических заклиниваний осей и инструментального магазина',
      'Восстановление оборванной электропроводки, кабелеукладчиков и датчиков',
      'Устранение аварийных течей гидравлических магистралей и фитингов',
      'Ремонт или замена аварийного концевого выключателя'
    ],
    description: 'Срочные восстановительные работы для минимизации простоя производства.',
    colorClasses: {
      bg: 'bg-rose-50/70',
      border: 'border-rose-200',
      text: 'text-rose-900',
      badgeBg: 'bg-rose-100 text-rose-800',
      badgeText: 'text-rose-800',
      badgeBorder: 'border-rose-300',
      chipActive: 'bg-rose-600 text-white shadow-rose-200',
      iconBg: 'bg-rose-500 text-white',
      iconText: 'text-rose-600',
      glow: 'shadow-rose-100'
    }
  }
};

export function getToirCategory(type?: string): ToirCategoryConfig {
  if (type === 'diagnostic' || type === 'inspection') {
    return TOIR_CATEGORIES.diagnostic;
  }
  if (type === 'ppr') {
    return TOIR_CATEGORIES.ppr;
  }
  if (type === 'emergency' || type === 'repair') {
    return TOIR_CATEGORIES.emergency;
  }
  // Default to routine
  return TOIR_CATEGORIES.routine;
}

export function calculateDeadlineInfo(dateStr: string) {
  if (!dateStr) {
    return {
      diffDays: 999,
      isOverdue: false,
      isToday: false,
      isUpcoming: false,
      label: 'Дата не назначена',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
    };
  }

  const targetDate = new Date(dateStr);
  const now = new Date();
  
  // Set both to midnight for exact day comparison
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const diffDays = Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      diffDays,
      isOverdue: true,
      isToday: false,
      isUpcoming: false,
      label: `Просрочено на ${absDays} ${pluralizeDays(absDays)}!`,
      badgeClass: 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse font-black'
    };
  } else if (diffDays === 0) {
    return {
      diffDays,
      isOverdue: false,
      isToday: true,
      isUpcoming: false,
      label: 'Срок сегодня!',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-black'
    };
  } else if (diffDays <= 7) {
    return {
      diffDays,
      isOverdue: false,
      isToday: false,
      isUpcoming: true,
      label: `Через ${diffDays} ${pluralizeDays(diffDays)}`,
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold'
    };
  } else {
    return {
      diffDays,
      isOverdue: false,
      isToday: false,
      isUpcoming: false,
      label: `Через ${diffDays} ${pluralizeDays(diffDays)}`,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
    };
  }
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
