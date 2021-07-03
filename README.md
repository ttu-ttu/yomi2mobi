Convert Yomichan dictionary to Kindle dictionary (MOBI)

Usage:
1. `npx ts-node ./src/app.ts -i "dicts/jmdict" -o "output" -t "JMDict"`
2. `kindlegen "output/JMDict.opf"`

Do note that the implementation for deinflection is incomplete


References:
- [Creating Dictionaries (Amazon Kindle)](https://kdp.amazon.com/en_US/help/topic/G2HXJS944GL88DNV)
