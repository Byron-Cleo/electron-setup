import * as osUtils from "os-utils";
import os from "os";
import fs from "fs";

const POLLING_INTERVAL = 500;

export function pollResources() {
  setInterval(async () => {
    const cpuUsage = await getCPUUsage();
    const ramUsage = await getRamUsage();
    const storageData = getStorageData();

    console.log({ cpuUsage, ramUsage, storageData: storageData.usage });
  }, POLLING_INTERVAL);
}

export function getSaticData() {
  const totalStorage = getStorageData().total;
  const cpuModel = os.cpus()[0].model;
  const totalMemoryGB = Math.floor(osUtils.totalmem() / 1024);

  return {
    totalStorage,
    cpuModel,
    totalMemoryGB,
  };
}

function getCPUUsage() {
  return new Promise((resolve) => {
    osUtils.cpuUsage((percentage: number) => {
      resolve(percentage);
    });
  });
}

function getRamUsage() {
  return (1 - osUtils.freememPercentage()) * 100;
}

function getStorageData() {
  const stats = fs.statfsSync(process.platform === "win32" ? "c://" : "/");
  const total = stats.bsize * stats.blocks;
  const free = stats.bsize * stats.bfree;

  return {
    total: Math.floor(total / 1_000_000_000),
    usage: 1 - free / total,
  };
}
