declare module 'jpeg-js' {
  export interface RawImageData {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export interface DecodeOptions {
    useTArray?: boolean;
    formatAsRGBA?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  }

  export interface EncodeInput {
    data: Uint8Array;
    width: number;
    height: number;
  }

  export interface EncodedImage {
    data: Uint8Array;
    width: number;
    height: number;
  }

  export function decode(data: Uint8Array | ArrayBuffer, opts?: DecodeOptions): RawImageData;
  export function encode(image: EncodeInput, quality?: number): EncodedImage;
}
