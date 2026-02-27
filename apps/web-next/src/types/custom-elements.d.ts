/* Custom HTML element type declarations */
declare namespace JSX {
    interface IntrinsicElements {
        'emoji-picker': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
            class?: string;
        };
    }
}
