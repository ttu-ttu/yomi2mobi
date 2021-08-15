export class FilenameGenerator {

  private count = 0;

  generate(): string {
    // not radix 36 to avoid Windows reserved words
    // https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#naming-conventions
    const result = this.count.toString(16);
    this.count += 1;
    return result;
  }
}
