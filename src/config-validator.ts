import Ajv, { ValidateFunction } from "ajv";
import ajvErrors from "ajv-errors";
import { JTDDataType } from "ajv/dist/jtd";
import {
  InitConfig,
  IPackageConfigSchema,
  Nullable,
  PartialInitConfig,
  ValidCommand,
} from "./types";

interface IErrorInfo {
  instancePath: string;
  message?: string;
}

interface IValidateErrors {
  emptyEventOrMatch: IErrorInfo;
}

type PrefixToKeys<T> = {
  [K in keyof T as `filewatcher.${string & K}`]: T[K];
};

type ConfigSchema = PrefixToKeys<PartialInitConfig>;
type SchemaType = JTDDataType<IPackageConfigSchema>;

class ConfigValidator {
  public isValid: boolean = false;
  public errorMessage: Nullable<string> = null;
  private validator: ValidateFunction;
  private errorTemplates: IValidateErrors = {
    emptyEventOrMatch: {
      message:
        'some property of "match", "event", ("cmd" or "vscodeTask") are empty in commands',
      instancePath: "settings.json",
    },
  };

  public constructor(packageConfigSchema: IPackageConfigSchema) {
    const ajv: Ajv = new Ajv({ allErrors: true });
    ajvErrors(ajv);
    this.validator = ajv.compile<SchemaType>(packageConfigSchema);
  }

  private getConfigSchema(config: PartialInitConfig): ConfigSchema {
    const prefixFileWatcher: string = "filewatcher.";
    const entriesWithPrefix = Object.entries<PartialInitConfig>(config).map(
      ([key, value]) => [`${prefixFileWatcher}${key}`, value]
    );
    return Object.fromEntries(entriesWithPrefix) as ConfigSchema;
  }

  private isValidCommands(config: PartialInitConfig): boolean {
    const { commands } = config;
    if (commands != undefined && commands.length > 0) {
      return commands.every(({ event, match, cmd, vscodeTask }) => {
        const isTask: boolean = Boolean(cmd || vscodeTask);
        return event && match && isTask;
      });
    }
    return false;
  }

  private getValidLine(items: Array<Nullable<string>>): Nullable<string> {
    const arr: Array<Nullable<string>> = items.filter(Boolean);
    return arr.length > 0 ? arr.join(", ") : null;
  }

  private getLineMessage({
    instancePath,
    message,
  }: IErrorInfo): Nullable<string> {
    const messages: Array<Nullable<string>> = [
      instancePath || null,
      message || null,
    ];
    return this.getValidLine(messages);
  }

  private getErrorMsg(isValidCommands: boolean): Nullable<string> {
    const startOfMsg: string = "Config validation error in settings.json: \n";
    const errorCommands = !isValidCommands
      ? [this.errorTemplates.emptyEventOrMatch]
      : [];
    const errors = [...errorCommands, ...(this.validator.errors ?? [])];
    return (
      errors.reduce((errorMsg, errorInfo: IErrorInfo) => {
        const lineMsg: Nullable<string> = this.getLineMessage(errorInfo);
        if (lineMsg != null) {
          errorMsg += `${lineMsg} \n`;
        }
        return errorMsg;
      }, startOfMsg) || null
    );
  }

  public validate(
    config: PartialInitConfig
  ): config is InitConfig<ValidCommand> {
    const isValidByScheme: boolean = this.validator(
      this.getConfigSchema(config)
    );
    const isValidCommands: boolean = this.isValidCommands(config);
    this.isValid = isValidByScheme && isValidCommands;
    this.errorMessage = this.getErrorMsg(isValidCommands);
    return this.isValid;
  }
}

export default ConfigValidator;
