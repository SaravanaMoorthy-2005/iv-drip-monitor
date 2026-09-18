import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';
// Adapted from the supplied liquid-glass template. Text stays outside distortion filters.
export function LiquidCard({className,...props}:ComponentProps<'div'>){return <div data-slot="liquid-card" className={cn('liquid-card',className)} {...props}/>;}
export {Card,CardHeader,CardFooter,CardTitle,CardAction,CardDescription,CardContent} from './card';
export default LiquidCard;
