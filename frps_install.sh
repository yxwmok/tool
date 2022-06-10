#!/bin/sh

rm -rf /tmp/frps && mkdir /tmp/frps
wget --no-check-certificate  -O /tmp/frps/frps.zip https://raw.githubusercontent.com/yxwmok/openclash/main/frps_install/frps.zip && unzip -o /tmp/frps/frps.zip -d /tmp/frps
sudo -s rm -rf /usr/local/frp && sudo -s mkdir /usr/local/frp
sudo -s mv /tmp/frps/frps /usr/local/frp
sudo -s chmod +x /usr/local/frp/frps
sudo -s mv /tmp/frps/frps.ini /usr/local/frp
sudo -s rm -rf /etc/init.d/frps
sudo -s mv /tmp/frps/frps_shell.d /etc/init.d/frps
sudo -s chmod +x /etc/init.d/frps
sudo -s sed -i "s#sh /etc/init.d/frps start##g" /etc/rc.d/rc.local
sudo -s sed -i '/touch \/var\/lock\/subsys\/local/a sh /etc/init.d/frps start' /etc/rc.d/rc.local
sudo -s sed -i 's/exit \+0//' /etc/rc.d/rc.local
sudo -s sed -i '/sh \/etc\/init.d\/frps start/a exit 0' /etc/rc.d/rc.local
rm -rf /tmp/frps
sudo -s chmod +x /etc/rc.d/rc.local
echo "系统将在3秒后重启..."
sleep 3
sudo -s reboot
