import {
  Space,
  Material,
  SportKit,
  Requester,
  Loan,
  Reservation,
  NoticeBoardItem,
  CoefRegulation,
  UserProfile,
  SportCategory,
} from '../types/sigef';

export const DEFAULT_SPORT_CATEGORIES: SportCategory[] = [
  { id: 'volei', name: 'Voleibol' },
  { id: 'futsal', name: 'Futsal' },
  { id: 'futebol', name: 'Futebol de Campo' },
  { id: 'basquete', name: 'Basquetebol' },
  { id: 'handebol', name: 'Handebol' },
  { id: 'atletismo', name: 'Atletismo' },
  { id: 'lutas', name: 'Lutas & Artes Marciais' },
  { id: 'danca', name: 'Dança & Ginástica' },
  { id: 'musculacao', name: 'Musculação & Funcional' },
  { id: 'recreacao', name: 'Recreação & Jogos' },
  { id: 'badminton', name: 'Badminton' },
  { id: 'tenis_mesa', name: 'Tênis de Mesa' },
  { id: 'natacao', name: 'Natação & Aquáticos' },
  { id: 'xadrez', name: 'Xadrez & Tabuleiro' },
  { id: 'beach_tennis', name: 'Beach Tennis' },
];

// System starts completely blank without any pre-registered admin. Users/Admin are created directly at login.
export const INITIAL_USERS: UserProfile[] = [];

// Completely blank initial database: no pre-registered spaces, materials, kits, schedules or requesters
export const INITIAL_SPACES: Space[] = [];

export const INITIAL_MATERIALS: Material[] = [];

export const INITIAL_KITS: SportKit[] = [];

export const INITIAL_REQUESTERS: Requester[] = [];

export const INITIAL_LOANS: Loan[] = [];

export const INITIAL_RESERVATIONS: Reservation[] = [];

export const INITIAL_NOTICES: NoticeBoardItem[] = [];

export const INITIAL_REGULATION: CoefRegulation = {
  rules: [
    {
      id: 'rule-1',
      title: 'Identificação e Cadastro Obrigatório',
      text: 'A retirada de qualquer material esportivo ou uso reservado de espaços físicos exige apresentação de documento institucional oficial com foto ou número de matrícula/SIAPE ativo.',
    },
    {
      id: 'rule-2',
      title: 'Prazos de Devolução e Horários Limite',
      text: 'Materiais para aulas regulares devem ser devolvidos impreterivelmente até o término do horário letivo do turno correspondente. Empréstimos de fim de semana exigem autorização expressa da Coordenação.',
    },
    {
      id: 'rule-3',
      title: 'Termo de Responsabilidade e Vistoria no Balcão',
      text: 'Ao assinar digitalmente o Termo de Empréstimo, o solicitante atesta que recebeu os itens em perfeitas condições e assume a responsabilidade pela guarda, conservação e reposição em caso de avarias dolosas ou extravios.',
    },
  ],
  contact: {
    campus: 'Instituto Federal de Educação, Ciência e Tecnologia',
    department: 'Diretoria de Ensino • Coordenação de Educação Física (COEF)',
    building: 'Complexo Poliesportivo e Recreativo',
    room: 'Coordenação de Educação Física',
    email: 'coef@ifcampus.edu.br',
    phone: '(00) 0000-0000',
    whatsapp: '(00) 00000-0000',
    openingHours: 'Segunda a Sexta-feira: 07:00 às 22:00',
    coordinatorName: 'Coordenador da COEF',
    siapeCoordinator: 'SIAPE 0000001',
  },
};
