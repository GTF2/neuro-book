import type {UnifiedTodoKind, UnifiedTodoSource} from "nbook/app/components/novel-ide/agent/unified-todo";

/**
 * K1 灵感库（用户拍板：做）——未选项/被拒提案的可用残料自动入库可回捡。
 * 数据层随 G1 落库；回捡入口=驾驶舱待办行（形态细节后补，数据层先立）。
 * 持久化经注入的 storage（真实场景 localStorage；测试注入内存实现）——SSR 安全。
 */
export type InspirationEntry = {
    id: string;
    kind: UnifiedTodoKind;
    source: UnifiedTodoSource;
    title: string;
    archivedAt: number;
    raw: unknown;
};

export type InspirationMemoryStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export const INSPIRATION_STORAGE_KEY = "unified-todo:inspirations";

export type InspirationLibrary = {
    archive(entry: InspirationEntry): void;
    /** 最新在前。 */
    list(): InspirationEntry[];
    /** 回捡=取走并从库中移除（回到待办流由调用方路由）。 */
    take(id: string): InspirationEntry | null;
};

export function createInspirationLibrary(storage: InspirationMemoryStorage): InspirationLibrary {
    function load(): InspirationEntry[] {
        const raw = storage.getItem(INSPIRATION_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        try {
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as InspirationEntry[]) : [];
        } catch {
            return [];
        }
    }

    function save(entries: InspirationEntry[]): void {
        storage.setItem(INSPIRATION_STORAGE_KEY, JSON.stringify(entries));
    }

    return {
        archive(entry) {
            save([entry, ...load().filter((existing) => existing.id !== entry.id)]);
        },
        list() {
            return [...load()];
        },
        take(id) {
            const entries = load();
            const taken = entries.find((entry) => entry.id === id) ?? null;
            if (taken) {
                save(entries.filter((entry) => entry.id !== id));
            }
            return taken;
        },
    };
}
