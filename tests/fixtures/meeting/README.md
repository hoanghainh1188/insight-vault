# Fixture cuộc họp (186)

`speech-16k.wav` — WAV PCM16, 16 kHz, mono, ≈ 54 s:

| Đoạn          | Thời lượng | Nội dung                                                                                            |
| ------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| 0 – 30,8 s    | ≈ 30,8 s   | Tiếng Việt (giọng hệ thống macOS "Linh"): họp rà soát tiến độ, có quyết định, việc cần làm, câu hỏi |
| 30,8 – 32,8 s | 2 s        | Im lặng                                                                                             |
| 32,8 – 44,3 s | ≈ 11,5 s   | English (giọng hệ thống macOS "Samantha")                                                           |
| 44,3 – 54,3 s | 10 s       | Im lặng (kiểm VAD / ảo giác)                                                                        |

**Nguồn và giấy phép**: tự sinh bằng lệnh `say` của macOS từ văn bản do dự án viết (không ghi âm người thật, không dùng tư liệu có bản quyền của bên thứ ba).
Dùng cho kiểm thử nội bộ (`IV_E2E_FAKE_MIC`, `IV_ASR_FAKE`, bộ đo spike S2).

Tái tạo:

```bash
say -v Linh -r 170 -o vi.wav --file-format=WAVE --data-format=LEI16@16000 "<văn bản tiếng Việt>"
say -v Samantha -r 180 -o en.wav --file-format=WAVE --data-format=LEI16@16000 "<English text>"
```

rồi nối dữ liệu PCM: vi + 2 s im lặng + en + 10 s im lặng, ghi lại header WAV.
