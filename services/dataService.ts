
import { Resident, Poll, VoteRecord, PollCalculationType, User, AssemblyRecord } from '../types';

const STORAGE_KEYS = {
  RESIDENTS: 'condovote_residents',
  POLLS: 'condovote_polls',
  VOTES: 'condovote_votes',
  USERS: 'condovote_users',
  ADMIN_AUTH: 'condovote_admin_auth',
  CONDO_NAME: 'condovote_condo_name',
  ASSEMBLIES: 'condovote_assemblies_history',
  IS_ASSEMBLY_ACTIVE: 'condovote_is_active' // New Key
};

export const saveAssemblyStatus = (isActive: boolean) => {
  localStorage.setItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE, JSON.stringify(isActive));
};

export const getAssemblyStatus = (): boolean => {
  const data = localStorage.getItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE);
  return data ? JSON.parse(data) : false;
};

export const saveResidents = (residents: Resident[]) => {
  localStorage.setItem(STORAGE_KEYS.RESIDENTS, JSON.stringify(residents));
};

export const getResidents = (): Resident[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RESIDENTS);
  return data ? JSON.parse(data) : [];
};

export const savePolls = (polls: Poll[]) => {
  localStorage.setItem(STORAGE_KEYS.POLLS, JSON.stringify(polls));
};

export const getPolls = (): Poll[] => {
  const data = localStorage.getItem(STORAGE_KEYS.POLLS);
  if (data) {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) && parsed.title) {
       // Legacy migration
       return [{...parsed, id: parsed.id || 'legacy-id', calculationType: PollCalculationType.NORMAL}];
    }
    return parsed;
  }
  return [];
};

export const saveVotes = (votes: VoteRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.VOTES, JSON.stringify(votes));
};

export const getVotes = (): VoteRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.VOTES);
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (data) {
    return JSON.parse(data);
  }
  // Default seed users if none exist
  const defaultUsers: User[] = [
    { id: '1', name: 'Administrador', username: 'admin', password: 'admin', role: 'ADMIN' },
    { id: '2', name: 'Wagner Silva', username: 'wagner.silva', password: 'wagner21', role: 'TI' },
    { id: '3', name: 'Fillype Sampaio', username: 'fillype.sampaio', password: 'fellypi123', role: 'ADMIN', jobTitle: 'Administrador' },
    { id: '4', name: 'Zeferino Batista', username: 'zeferino.batista', password: 'zeferino123', role: 'ADMIN', jobTitle: 'Administrador' },
    { id: '5', name: 'Wagner Lima', username: 'wagner.lima', password: 'wagner21', role: 'TI' }
  ];
  return defaultUsers;
};

export const saveCondoName = (name: string) => {
  localStorage.setItem(STORAGE_KEYS.CONDO_NAME, name);
};

export const getCondoName = (): string => {
  return localStorage.getItem(STORAGE_KEYS.CONDO_NAME) || '';
};

export const saveAssemblies = (assemblies: AssemblyRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.ASSEMBLIES, JSON.stringify(assemblies));
};

export const getAssemblies = (): AssemblyRecord[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSEMBLIES);
  return data ? JSON.parse(data) : [];
};

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEYS.RESIDENTS);
  localStorage.removeItem(STORAGE_KEYS.POLLS);
  localStorage.removeItem(STORAGE_KEYS.VOTES);
  localStorage.removeItem(STORAGE_KEYS.CONDO_NAME);
  localStorage.removeItem(STORAGE_KEYS.IS_ASSEMBLY_ACTIVE);
  // We generally don't clear users or history on a data wipe to prevent lockout/dataloss
};

export const parseCSV = (csvText: string): Resident[] => {
  const lines = csvText.split('\n');
  const residents: Resident[] = [];

  // Skip header if it exists
  let startIndex = 0;
  if (lines[0] && (lines[0].toLowerCase().includes('cpf') || lines[0].toLowerCase().includes('unidade'))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const delimiter = line.includes(';') ? ';' : ',';
    const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));

    // NEW Expected format: CPF, Unit, Name, Delinquent, HabiteSe (opt), Fraction (opt)
    if (cols.length >= 3) {
      
      // Col 0: CPF (Strip everything except numbers)
      const cpfRaw = cols[0] || '';
      const cpf = cpfRaw.replace(/\D/g, ''); // Removes dots, hyphens, spaces

      // Col 1: Unit
      const unit = cols[1];

      // Col 2: Name
      const name = cols[2];
      
      const isDelinquentStr = cols[3] ? cols[3].toUpperCase() : 'NÃO';
      const isDelinquent = isDelinquentStr === 'SIM' || isDelinquentStr === 'YES' || isDelinquentStr === 'TRUE';
      
      const hasHabiteSeStr = cols[4] ? cols[4].toUpperCase() : 'NÃO';
      const hasHabiteSe = hasHabiteSeStr === 'SIM' || hasHabiteSeStr === 'YES' || hasHabiteSeStr === 'TRUE';

      // Parse fraction (handle comma as decimal separator)
      let fraction = 1.0;
      // FIX: Robust check to ensure column exists before accessing methods
      if (cols.length > 5 && cols[5]) {
        const cleanNum = cols[5].replace(',', '.');
        const parsed = parseFloat(cleanNum);
        if (!isNaN(parsed)) fraction = parsed;
      }

      residents.push({ 
        unit, 
        name, 
        isDelinquent, 
        hasHabiteSe, 
        fraction,
        cpf, // Stored as pure numbers
        attendanceStatus: 'NONE' // Default status
      });
    }
  }
  return residents;
};

export const exportVotesToCSV = (votes: VoteRecord[], residents: Resident[], poll: Poll) => {
  const headers = ['Unidade', 'Nome', 'CPF', 'Inadimplente', 'Habite-se', 'Fração', 'Opção Votada', 'Peso do Voto', 'Contabilizado', 'Data/Hora'];
  
  const pollVotes = votes.filter(v => v.pollId === poll.id);

  const rows = pollVotes.map(vote => {
    const resident = residents.find(r => r.unit === vote.unit);
    const option = poll.options.find(o => o.id === vote.optionId);
    
    let voteWeight = 0;
    if (!vote.isDelinquentVote && resident) {
      if (poll.calculationType === PollCalculationType.FRACTION) {
        voteWeight = resident.fraction;
      } else if (poll.calculationType === PollCalculationType.HABITE_SE) {
        voteWeight = 1 + (resident.hasHabiteSe ? 1 : 0);
      } else {
        voteWeight = 1;
      }
    }

    return [
      vote.unit,
      resident ? resident.name : 'Desconhecido',
      resident?.cpf ? resident.cpf : '',
      vote.isDelinquentVote ? 'SIM' : 'NÃO',
      resident?.hasHabiteSe ? 'SIM' : 'NÃO',
      resident?.fraction?.toString().replace('.', ',') || '0',
      option ? option.text : 'Erro',
      voteWeight.toString().replace('.', ','),
      vote.isDelinquentVote ? 'NÃO' : 'SIM',
      new Date(vote.timestamp).toLocaleString('pt-BR')
    ].map(field => `"${field}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `resultado_${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAttendanceCSV = (residents: Resident[], condoName: string) => {
  const headers = ['Unidade', 'Nome do Proprietário', 'CPF', 'Nome no Zoom', 'Horário de Entrada', 'Status'];
  
  // Filter only approved residents for the list
  const presentResidents = residents.filter(r => r.attendanceStatus === 'APPROVED');

  const rows = presentResidents.map(r => {
    return [
      r.unit,
      r.name,
      r.cpf ? r.cpf : '',
      r.zoomName || '',
      r.checkInTimestamp ? new Date(r.checkInTimestamp).toLocaleString('pt-BR') : '-',
      'PRESENTE (APROVADO)'
    ].map(field => `"${field}"`).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeName = condoName ? condoName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'condominio';
  link.setAttribute('download', `lista_presenca_${safeName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
