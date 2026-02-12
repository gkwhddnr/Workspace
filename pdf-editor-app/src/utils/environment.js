// 현재 앱이 Electron 환경에서 실행 중인지 확인하는 함수
export const isElectron = () => {
    // 1. process 객체가 있는지 확인
    // 2. process.versions에 electron이 포함되어 있는지 확인
    return typeof window !== 'undefined' && 
           typeof window.process !== 'undefined' && 
           Boolean(window.process.versions.electron);
};

// 필요하다면 다른 환경 변수들도 여기서 관리하면 편합니다.
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;