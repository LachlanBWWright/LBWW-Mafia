import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../nextjs/src/server/api/root';

export const api = createTRPCReact<AppRouter>();
