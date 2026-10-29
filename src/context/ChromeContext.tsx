import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Trạng thái ẩn/hiện "chrome" của app (navbar + dock).
 * Màn hình đọc truyện chạm vào nội dung để bật/tắt chế độ toàn màn hình.
 */
interface ChromeState {
  hidden: boolean;
  setHidden: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<ChromeState>({
  hidden: false,
  setHidden: () => {},
  toggle: () => {},
});

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((v: boolean) => setHiddenState(v), []);
  const toggle = useCallback(() => setHiddenState((h) => !h), []);
  return <Ctx.Provider value={{ hidden, setHidden, toggle }}>{children}</Ctx.Provider>;
}

export function useChrome() {
  return useContext(Ctx);
}
