import type * as React from 'react';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md' | 'lg'; block?: boolean }
export declare function Button(props: ButtonProps): React.ReactElement;
export interface BadgeProps { tone?: 'neutral' | 'verified' | 'gap' | 'changed'; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;
export interface SourceTagProps { /** Where the line came from, e.g. "Razorfin › fact #4" */ from: string; className?: string }
export declare function SourceTag(props: SourceTagProps): React.ReactElement;
export interface HighlightProps { /** Previous text, shown struck through before the new text */ was?: string; /** Play the highlighter sweep once */ animate?: boolean; children?: React.ReactNode; className?: string }
export declare function Highlight(props: HighlightProps): React.ReactElement;
export interface ChangeLineProps { text: React.ReactNode; was?: string; from?: string; reason?: string; animate?: boolean; onUndo?: () => void; className?: string }
export declare function ChangeLine(props: ChangeLineProps): React.ReactElement;
export interface GapPromptProps { skill: string; level?: string; onAdd?: () => void; onSkip?: () => void; className?: string }
export declare function GapPrompt(props: GapPromptProps): React.ReactElement;
export interface ResumeSheetProps { name?: string; role?: string; children?: React.ReactNode; className?: string }
export declare function ResumeSheet(props: ResumeSheetProps): React.ReactElement;
export interface PassCardProps { name: string; price: string; per?: string; features?: string[]; featured?: boolean; cta?: string; note?: string; onSelect?: () => void; className?: string }
export declare function PassCard(props: PassCardProps): React.ReactElement;
export interface PromiseStripProps { items?: string[]; className?: string }
export declare function PromiseStrip(props: PromiseStripProps): React.ReactElement;
export interface WordmarkProps { /** Font size in px (default 32) */ size?: number; className?: string }
export declare function Wordmark(props: WordmarkProps): React.ReactElement;
declare global { interface Window { Rezz: { Button: typeof Button; Badge: typeof Badge; SourceTag: typeof SourceTag; Highlight: typeof Highlight; ChangeLine: typeof ChangeLine; GapPrompt: typeof GapPrompt; ResumeSheet: typeof ResumeSheet; PassCard: typeof PassCard; PromiseStrip: typeof PromiseStrip; Wordmark: typeof Wordmark } } }
