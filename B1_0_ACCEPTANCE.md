# B1-0 词书验收

数据来源：`歌德B1词包-分层版.csv` 与 `歌德B1词包-分层版 (1).json`。两份文件逐条一致；内置词书由这两份文件校验后生成。

| 检查项 | 结果 |
|---|---:|
| B1 唯一词 | 1,740 |
| 核心主动 | 1,070 |
| 被动认读 | 569 |
| 扩展认读 | 101 |
| 核心累计（A1 340 + A2 355 + B1 1,070） | 1,765 |
| 与 A1/A2 重叠 | 0 |
| 词性白名单外 | 0 |
| 名词缺复数 | 93 |

旧 B1 词书中的五个低级别重复词 `danach`、`fühlen`、`hungrig`、`her`、`herein` 已从新 B1 词书删除。`Schülerin` 的冠词由 `der` 改为 `die`；升级旧词书时，导入流程沿用原词条 ID、顺序和学习进度，并更新为新键。

依用户澄清，只有以下 14 条属于本包的构词碎片，均为「短语 / 扩展认读」：`-weise`、`aller-`、`Bio-`、`Doppel-`、`Groß-`、`Haupt-`、`miss-`、`Not-`、`Schwieger-`、`Speise-/Speise`、`Spezial-`、`un-`、`unter-`、`über-`。其余 29 条词干写法沿用分层文件原词性与 layer，未降层。

## 原先缺复数名词的处理

补充 6 条：`Flucht → Fluchten`、`Forschung → Forschungen`、`Gewalt → Gewalten`、`Mehrwertsteuer → Mehrwertsteuern`、`Schuld → Schulden`、`Strom → Ströme`。

以下 93 条在分层文件中继续保留空复数：

1. Alltag、Aussprache、Bedarf、Benzin、Besserung、Biologie、Blut、Dauer、Dreck、Eile、Erde、Erholung、Ernährung、Essig、Faschierte、Fasching、Fasnacht、Freude、Friede、Gebäck
2. Geduld、Gewissen、Gold、Golf、Gymnastik、Hackfleisch、Handel、Heimweh、Hitze、Humor、Husten、Intelligenz、Jugend、Kakao、Kindheit、Kommunikation、Konkurrenz、Kriminalpolizei、Kälte、Landwirtschaft
3. Langeweile、Leder、Liebe、Luft、Lärm、Matura、Medizin、Mehl、Mut、Müllabfuhr、Nachwuchs、Obers、Pech、Personal、Personenstand、Pfeffer、Plastik、Politik、Presse、Publikum
4. Rahm、Rat、Respekt、Rückkehr、Sahne、Sand、Schlaf、Schnupfen、Schutz、Staub、Teilzeit、Tempo、Tod、Tourismus、Umwelt、Umweltschutz、Verantwortung、Verdacht、Vergangenheit、Verhalten
5. Verständnis、Vertrauen、Vollzeit、Vorfahrt、Wirtschaft、Wissen、Wolle、Wärme、Zeug/-zeug、Zukunft、Zusammenarbeit、Zvieri、Öffentlichkeit

以上是文件实际处理结果；未自行补写或改动词义、例句、分层。
