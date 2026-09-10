import axios from 'axios';

// AI 코파일럿 대화 스레드 백엔드 (Spring) 연동 서비스
// - 스레드 목록/본문은 백엔드 H2(SQLite) DB에 저장되어 앱 재시작 후에도 유지됩니다.
// - 백엔드 접근이 불가능한 오프라인 상황을 위해 localStorage(useAppStore)는 캐시로 유지됩니다.

export interface AiThreadMessageDto {
    role: 'user' | 'assistant';
    content: string;
    agent?: string;
}

export interface AiThreadDto {
    id: string;
    title: string;
    messages?: AiThreadMessageDto[];
    messagesJson?: string;
    createdAt?: string;
    updatedAt?: string;
}

const aiClient = axios.create({
    baseURL: '/api/pdf',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

const parseMessages = (dto: AiThreadDto): AiThreadMessageDto[] => {
    const raw = Array.isArray(dto.messages)
        ? dto.messages
        : (dto.messagesJson ?? '[]');
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/** 전체 스레드를 최근 갱신순으로 가져옵니다(messages 포함). */
export async function fetchAiThreads(): Promise<Array<AiThreadDto & { messages: AiThreadMessageDto[] }>> {
    const res = await aiClient.get<AiThreadDto[]>('/ai-threads');
    const list = Array.isArray(res.data) ? res.data : [];
    return list.map(d => ({ ...d, messages: parseMessages(d) }));
}

/** 스레드 1건을 저장(생성/갱신)합니다. Upsert 방식이라 항상 안전합니다. */
export async function saveAiThread(id: string, title: string, messages: AiThreadMessageDto[]): Promise<void> {
    await aiClient.post('/ai-threads', {
        id,
        title,
        messagesJson: JSON.stringify(messages),
    });
}

/** 스레드를 삭제합니다. */
export async function deleteAiThreadBackend(id: string): Promise<void> {
    await aiClient.delete(`/ai-threads/${encodeURIComponent(id)}`);
}