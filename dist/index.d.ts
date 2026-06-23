import { QuartzTransformerPlugin } from '@quartz-community/types';
export { QuartzTransformerPlugin } from '@quartz-community/types';
import { TikzOptions } from './types.js';

declare const TikzJax: QuartzTransformerPlugin<TikzOptions>;

export { TikzJax, TikzOptions };
