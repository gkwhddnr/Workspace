import type { usePdfEditorStore } from '../store/usePdfEditorStore';
import type { useAppStore } from '../store/useAppStore';

// 플러그인 라이프사이클 훅
export interface PluginHooks {
    // 사용자 UI에서 "실행" 버튼을 눌렀을 때 호출됨
    onRun?: (ctx: PluginContext) => void | Promise<void>;
    // 플러그인이 로드(활성화)될 때 1회 호출됨
    onActivate?: (ctx: PluginContext) => void | Promise<void>;
    // 플러그인이 비활성화/제거될 때 호출됨 (정리용)
    onDeactivate?: (ctx: PluginContext) => void | Promise<void>;
    // PDF 문서/페이지/요소가 변경될 때 호출됨
    onDocumentChange?: (ctx: PluginContext, payload: DocumentChangePayload) => void | Promise<void>;
    // AI 코파일럿이 선언된 기능을 호출할 때 실행되는 라우터
    onAiTool?: (ctx: PluginContext, toolName: string, args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface PluginAiToolDefinition {
    // plugin id와 조합해 고유하게 식별되는 도구 이름
    name: string;
    description: string;
    // AI가 인자를 구성하는 데 참고할 JSON Schema object
    parameters?: Record<string, unknown>;
}

// 플러그인 정의 (플러그인 스크립트가 export 하는 형태)
export interface PluginDefinition {
    id: string;
    name: string;
    version?: string;
    description?: string;
    author?: string;
    icon?: string;
    // 플러그인 실행 시 패널(화면)에 렌더링할 React 컴포넌트나 마운트 정보.
    // 실용적인 확장을 위해 "콘텐츠 렌더러"를 지원.
    render?: PluginRenderer;
    hooks?: PluginHooks;
    // AI 코파일럿에 공개할 기능 목록. 실제 처리는 hooks.onAiTool에서 라우팅한다.
    aiTools?: PluginAiToolDefinition[];
}

// 플러그인이 PDF 편집기에 접근할 수 있는 컨텍스트 (생성 시 주입)
export interface PluginContext {
    signal: AbortSignal;
    addCleanup: (cleanup: () => void | Promise<void>) => () => void;
    api: {
        // 편집기 공용 스토어 (요소 추가/삭제/이동, 페이지 탐색 등)
        editor: typeof usePdfEditorStore;
        // 앱 공용 스토어 (파일, 탭, 툴, 테마 등)
        app: typeof useAppStore;
        document: {
            getPageText: (page: number, signal?: AbortSignal) => Promise<PluginPageText>;
            summarizePage: (page: number, signal?: AbortSignal) => Promise<PluginPageDiagram>;
        };
    };
    log: (message: string, data?: unknown) => void;
    notify: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export interface DocumentChangePayload {
    type: 'page' | 'document' | 'elements' | 'selection';
    [key: string]: unknown;
}

export interface PluginPageText { page: number; text: string; truncated: boolean }
export interface PluginPageDiagram { page: number; title: string; summary: string; flow: string }

// 렌더러: 플러그인이 패널 UI를 제공할 때 사용.
// 현재는 문자열 기반 "콘텐츠" 또는 커스텀 마운트 함수를 지원.
export type PluginRenderer =
    | { kind: 'html'; html: string }
    | { kind: 'component'; mount: (container: HTMLElement, ctx: PluginContext) => () => void }
    | { kind: 'react'; component: unknown };

export interface PluginRegistryEntry {
    definition: PluginDefinition;
    // 외부에서 파싱한 상태 정보
    source: PluginSource;
    // 실행/활성화 상태
    active: boolean;
    status?: "inactive" | "activating" | "active" | "deactivating";
    evaluated?: boolean;
    // 원본 코드 (스크립트 소스)
    code: string;
    error?: string;
    // 활성화 시 생성된 컨텍스트
    context?: PluginContext;
    // 등록/로드 시간
    installedAt: number;
}

export type PluginSource =
    | { kind: 'file'; fileName: string }
    | { kind: 'url'; url: string }
    | { kind: 'code'; label: string }
    | { kind: 'builtin' };
