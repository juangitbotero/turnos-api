import { StorageService } from './storage.service';

describe('StorageService.isValidKey', () => {
  const id = '3f2b9c1e-8a4d-4f6b-9e2a-1c7d5b8e0f42';

  it('accepts the keys upload() produces', () => {
    expect(StorageService.isValidKey(`worker-photos/${id}.jpeg`)).toBe(true);
    expect(StorageService.isValidKey(`payment-proofs/${id}.pdf`)).toBe(true);
    expect(StorageService.isValidKey(`worker-cvs/${id}.docx`)).toBe(true);
  });

  it('refuses anything else before it reaches the bucket', () => {
    expect(StorageService.isValidKey(`../worker-photos/${id}.jpeg`)).toBe(false);
    expect(StorageService.isValidKey(`worker-photos/../../${id}.jpeg`)).toBe(false);
    expect(StorageService.isValidKey(`worker-photos/${id}`)).toBe(false);
    expect(StorageService.isValidKey(`worker-photos/not-a-uuid.jpeg`)).toBe(false);
    expect(StorageService.isValidKey(`a/b/${id}.jpeg`)).toBe(false);
    expect(StorageService.isValidKey('')).toBe(false);
  });
});
