declare module "qrcode-terminal" {
  const qrcode: {
    generate(value: string, options?: { small?: boolean }): void;
  };
  export default qrcode;
}

declare module "qrcode" {
  const QRCode: {
    toDataURL(value: string, options?: { width?: number; margin?: number }): Promise<string>;
    toBuffer(value: string, options?: { width?: number; margin?: number }): Promise<Buffer>;
  };
  export default QRCode;
}