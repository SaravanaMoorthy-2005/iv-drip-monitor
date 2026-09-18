'use client';
import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';
export function LiquidButton({className,variant='default',...props}:ComponentProps<'button'>&{variant?:'default'|'outline'|'destructive'}){
 return <button type="button" className={cn('liquid-button',`liquid-button-${variant}`,className)} {...props}/>;
}
