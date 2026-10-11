import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'creator:isPublic';

/** Opts a route out of the global session guard (default-deny). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
