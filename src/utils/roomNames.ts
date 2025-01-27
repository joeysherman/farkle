import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';

const customConfig: Config = {
  dictionaries: [adjectives, animals],
  separator: ' ',
  length: 2,
  style: 'capital'
};

export const generateRoomName = (): string => {
  return uniqueNamesGenerator(customConfig);
}; 