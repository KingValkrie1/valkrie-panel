# WhatsApp Bot Commands

The bot accepts commands from all users. Commands work in private chats and groups unless noted. Replies are sent in the same chat.

## Help and status

| Command | Function |
| --- | --- |
| `.menu` | Show the command overview. |
| `.help [fitur]` | Show all commands or help for a topic such as `ai`, `auto`, `jadwal`, or `sticker`. |
| `.ping`, `.status` | Check whether the bot is responding. |
| `.owner` | Show the bot's generic support message. |

## AI and chat

| Command | Function |
| --- | --- |
| `.ai <pertanyaan>`, `.ask`, `.gpt` | Ask the AI a question. A friendly setup message is returned when `OPENAI_API_KEY` is empty. |
| `.auto on/off/status`, `.autoreply`, `.autobalas` | Enable or disable automatic AI replies for the current chat. Ordinary AI replies are off until enabled per chat; dot commands remain available. |
| `.resetai`, `.clearai` | Clear the current chat's in-memory AI context. |

## Group features

| Command / event | Function |
| --- | --- |
| `.tagall [pesan]`, `.mentionall` | Mention group members. Available to group admins only. |
| New group member | The bot posts a welcome message and mentions up to 20 new members. |

## Media and downloads

| Command / message | Function |
| --- | --- |
| Send a TikTok link in a private chat | Download the no-watermark video, send it back, and save it locally. Downloads are limited to 64 MB. |
| Send an Instagram or YouTube link in a private chat | Detect the link and explain that automatic downloads currently support TikTok only. |
| `.saved` | List videos saved by the current private chat. |
| `.getsave <id>` | Send a saved video again. Private chat only. |
| `.sticker`, `.s`, `.stiker` | Attach one of these captions to an image/video to convert it into a WhatsApp sticker. Requires FFmpeg; on Termux install it with `pkg install ffmpeg`. Video stickers are limited to 7 seconds. |
| `.toimg`, `.toimage` | Reply to a sticker with this command to convert it to PNG. Requires FFmpeg. |
| `.qr <teks>` / `.qrcode` | Create and send a QR code image. |

## Productivity

| Command | Function |
| --- | --- |
| `.note tambah <teks>`, `.note`, `.note hapus <nomor>` | Add, list, or delete notes for the current chat. Alias: `.catatan`. |
| `.todo tambah <teks>`, `.todo`, `.todo selesai <nomor>`, `.todo hapus <nomor>` | Manage a task list for the current chat. Alias: `.tugas`. |
| `.reminder <menit> <pesan>` | Send a persisted one-time reminder (maximum 1,440 minutes); due reminders retry after reconnect. Aliases: `.ingatkan`, `.remindme`. |
| `.jadwal <waktu> | <pesan>` | Add a reminder, for example `.jadwal besok jam 8 | rapat`. Also supports `30 menit lagi`, daily schedules, `list`, and `hapus <id>`. Aliases: `.schedule`, `.ingatkanbesok`. |

## Information and utilities

| Command | Function |
| --- | --- |
| `.cuaca <kota>` | Current weather. Alias: `.weather`. |
| `.wiki <topik>` | Indonesian Wikipedia summary. Alias: `.wikipedia`. |
| `.kurs <jumlah> <asal> <tujuan>` | Currency conversion, e.g. `.kurs 100 USD IDR`. Aliases: `.convert`, `.currency`. |
| `.tr <kode> <teks>` | Translate text to a language code. Alias: `.translate`. |
| `.short <url>` | Shorten a URL. Aliases: `.shortlink`, `.pendekin`. |
| `.poll <pertanyaan>|<opsi>|<opsi>` | Create a WhatsApp poll. Aliases: `.polling`, `.voting`. |
| `.calc <ekspresi>` | Calculate arithmetic, e.g. `.calc (12*7)-3`. |
| `.pass [panjang]` | Generate a random password (4–64 characters). Aliases: `.password`, `.genpass`. |

## Fun

| Command | Function |
| --- | --- |
| `.quote`, `.kutipan` | Send a motivational quote. |
| `.pantun` | Send a pantun. |
| `.fakta`, `.fact` | Send a random fact. |
| `.meme` | Fetch and send a meme. |
| `.umur DD-MM-YYYY`, `.age` | Calculate age. |
| `.zodiak DD-MM`, `.zodiac` | Show a zodiac sign. |
| `.pilih a|b|c`, `.choose`, `.random` | Choose one option at random. |
| `.dadu`, `.dice` | Roll a die. |
| `.koin`, `.coinflip`, `.flip` | Flip a coin. |

## Notes

- Local saved videos, notes, tasks, and schedules are stored under `artifacts/api-server/data/`.
- AI replies require a valid `OPENAI_API_KEY` in the root `.env`; other commands do not require it.
- Downloader and information commands depend on their external services and an internet connection.
