export type UniversalMapCommand = {
  id: string;
  kind:
    | 'lookup-ip'
    | 'open-ip'
    | 'toggle-monochrome'
    | 'show-markers'
    | 'copy-center'
    | 'mark-center'
    | 'clear-transient';
  value?: string;
};
