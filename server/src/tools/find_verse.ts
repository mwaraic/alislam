import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const surahDictAr: Record<number, string> = {
  1: "الفاتحة",
  2: "البقرة",
  3: "آل عمران",
  4: "النساء",
  5: "المائدة",
  6: "الأنعام",
  7: "الأعراف",
  8: "الأنفال",
  9: "التوبة",
  10: "يونس",
  11: "هود",
  12: "يوسف",
  13: "الرعد",
  14: "إبراهيم",
  15: "الحجر",
  16: "النحل",
  17: "الإسراء",
  18: "الكهف",
  19: "مريم",
  20: "طه",
  21: "الأنبياء",
  22: "الحج",
  23: "المؤمنون",
  24: "النور",
  25: "الفرقان",
  26: "الشعراء",
  27: "النمل",
  28: "القصص",
  29: "العنكبوت",
  30: "الروم",
  31: "لقمان",
  32: "السجدة",
  33: "الأحزاب",
  34: "سبإ",
  35: "فاطر",
  36: "يس",
  37: "الصافات",
  38: "ص",
  39: "الزمر",
  40: "غافر",
  41: "فصلت",
  42: "الشورى",
  43: "الزخرف",
  44: "الدخان",
  45: "الجاثية",
  46: "الأحقاف",
  47: "محمد",
  48: "الفتح",
  49: "الحجرات",
  50: "ق",
  51: "الذاريات",
  52: "الطور",
  53: "النجم",
  54: "القمر",
  55: "الرحمن",
  56: "الواقعة",
  57: "الحديد",
  58: "المجادلة",
  59: "الحشر",
  60: "الممتحنة",
  61: "الصف",
  62: "الجمعة",
  63: "المنافقون",
  64: "التغابن",
  65: "الطلاق",
  66: "التحريم",
  67: "الملك",
  68: "القلم",
  69: "الحاقة",
  70: "المعارج",
  71: "نوح",
  72: "الجن",
  73: "المزمل",
  74: "المدثر",
  75: "القيامة",
  76: "الإنسان",
  77: "المرسلات",
  78: "النبأ",
  79: "النازعات",
  80: "عبس",
  81: "التكوير",
  82: "الانفطار",
  83: "المطففين",
  84: "الانشقاق",
  85: "البروج",
  86: "الطارق",
  87: "الأعلى",
  88: "الغاشية",
  89: "الفجر",
  90: "البلد",
  91: "الشمس",
  92: "الليل",
  93: "الضحى",
  94: "الشرح",
  95: "التين",
  96: "العلق",
  97: "القدر",
  98: "البينة",
  99: "الزلزلة",
  100: "العاديات",
  101: "القارعة",
  102: "التكاثر",
  103: "العصر",
  104: "الهمزة",
  105: "الفيل",
  106: "قريش",
  107: "الماعون",
  108: "الكوثر",
  109: "الكافرون",
  110: "النصر",
  111: "المسد",
  112: "الإخلاص",
  113: "الفلق",
  114: "الناس"
}

interface VerseResponse {
  ch: number
  v: number
  ar: string
  ur: string
  en: string
}

interface FormattedVerse {
  chapter: number
  verse: number
  ar: string
  ur: string
  en: string
}

export class FindVerseTool {
  
  public async findVerse(chapter: string, verse: string): Promise<string> {
    try {
      const chapterNum = parseInt(chapter)
      const verseNum = parseInt(verse)

      // Validate chapter and verse numbers
      if (isNaN(chapterNum) || isNaN(verseNum)) {
        return 'Invalid chapter or verse number. Please provide valid numbers.'
      }

      if (chapterNum < 1 || chapterNum > 114) {
        return 'Chapter number must be between 1 and 114.'
      }

      if (verseNum < 1) {
        return 'Verse number must be greater than 0.'
      }

      const response = await fetch(
        `https://api.openquran.com/express/chapter/${chapter}:${verse}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bn: false,
            cn: false,
            de: false,
            en: true,
            es: false,
            f: 1,
            fr: false,
            hover: 0,
            it: false,
            my: false,
            nw: false,
            sc: false,
            sp_en: false,
            sp_ur: false,
            sv: false,
            ts: false,
            ur: true,
            v5: false,
            zk: false
          })
        }
      )

      if (!response.ok) {
        return `Failed to fetch verse ${chapter}:${verse}. The verse may not exist.`
      }

      const data = await response.json() as VerseResponse[]

      if (!data || data.length === 0) {
        return `Verse ${chapter}:${verse} not found. Please check the chapter and verse numbers.`
      }

      const extracted: FormattedVerse[] = data.map(item => ({
        chapter: item.ch,
        verse: item.v,
        ar: `Surah ${surahDictAr[item.ch]}:${item.v}\n\n${item.ar}`,
        ur: `Surah ${surahDictAr[item.ch]}:${item.v}\n\n${item.ur}`,
        en: `Surah ${surahDictAr[item.ch]}:${item.v}\n\n${item.en}`,
      }))

      // Format the response
      const result = extracted.map(verse => 
        `Chapter ${verse.chapter}, Verse ${verse.verse}\n\n` +
        `Arabic:\n${verse.ar}\n\n` +
        `Urdu:\n${verse.ur}\n\n` +
        `English:\n${verse.en}\n\n` +
        `Reference Link: https://www.alislam.org/quran/app/${verse.chapter}:${verse.verse}`
      ).join('\n---\n\n')

      return result || 'No verse content found.'

    } catch (error) {
      console.error('Find verse error:', error)
      return `Error finding verse: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  public createTool() {
    return tool(
      async (input: { chapter: string; verse: string }) => {
        return await this.findVerse(input.chapter, input.verse)
      },
      {
        name: 'find_verse',
        description: 'Find a specific verse from the Holy Quran by chapter and verse number.',
        schema: z.object({
          chapter: z.string().describe('The chapter number (1-114)'),
          verse: z.string().describe('The verse number within the chapter')
        })
      }
    )
  }
}

// Factory function to create the tool
export function createFindVerseTool() {
  const findVerseTool = new FindVerseTool()
  return findVerseTool.createTool()
}
    
