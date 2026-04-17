import { Model, DataTypes } from "sequelize";
import meintoyouapp from "../config/config";
import { UserInterface } from "../interfaces/UserInterface";

class UserInt extends Model<UserInterface> implements UserInterface {
  id!: number;
  email!: string;
  phone?: string;
  password!: string;
  f_name?: string;
  l_name?: string;
  profile?: string;
  bio?: string;
  years?: number;
  city?: string;
  country?: string;
  ages?: number;
  secondages?: number;
  distance?: number;
  gender?: string;
  looking?: string;
  fors?: string;
  Orientation?: string;
  interest?: string;
  education?: string;
  newmessage?:boolean;
  newlikes?:boolean;
  tester?: boolean;
  schoolname?: string;
  // More about you (optional)
  height_cm?: number;
  hasKids?: boolean;
  wantsKids?: boolean;
  relationshipStatus?: string;
  smoking?: string;
  drinking?: string;
  exercise?: string;
  occupation?: string;
  industry?: string;
  languages?: string;
  religion?: string;
  showReligion?: boolean;
  pets_dogs?: boolean;
  pets_cats?: boolean;
  pets_other?: boolean;
  loveLanguages?: string;
  im1?: string;
  im2?: string;
  im3?: string;
  im4?: string;
  lats?: string;
  longs?: string;
  globe?: string;
  toppicks?: string;
  emailnotification?: string;
  push?: string;
  aproved?: string;
  progress?: number;
  subs?: string;
  OTP?: string;
  OTPExpiry?: Date;
  IsVerified?: boolean;
  isBlocked?: boolean;
  strikes?: number;
  signedWithGoogle?: string;
  lastActiveAt?: Date;
  isManualLocationUpdate?: boolean;

  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationDocType?: string;
  verificationDocFront?: string;
  verificationDocBack?: string;
  verificationVideo?: string;
  verificationSubmittedAt?: Date;
  verificationReviewedAt?: Date;
  verificationRejectionReason?: string;
}

const User = meintoyouapp.define<UserInt, UserInterface>(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(250),
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(250),
      allowNull: false,
    },
    f_name: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    l_name: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    profile: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    years: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    ages: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 18,
    },
    secondages: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 100,
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 50,
    },
    gender: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    looking: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fors: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    Orientation: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    interest: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    education: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    schoolname: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    // More about you (optional)
    height_cm: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    hasKids: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    wantsKids: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    relationshipStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'relationshipstatus',
    },
    smoking: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    drinking: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    exercise: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    occupation: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    industry: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    languages: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    religion: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    showReligion: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    },
    pets_dogs: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    pets_cats: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    pets_other: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    },
    loveLanguages: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'lovelanguages',
    },
    im1: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    im2: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    im3: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    im4: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    lats: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    longs: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    globe: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "false",
    },
    toppicks: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "true",
    },
    emailnotification: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "true",
    },
    push: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "true",
    },
    aproved: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "NO",
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    subs: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "FREE",
    },
    OTP: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    OTPExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    IsVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    strikes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    signedWithGoogle: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "NO",
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Active', 'Offline'),
      allowNull: false,
      defaultValue: 'Offline',
    },
    isManualLocationUpdate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    verificationStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unverified',
      validate: {
        isIn: [['unverified', 'pending', 'verified', 'rejected']],
      },
    },
    verificationDocType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    verificationDocFront: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    verificationDocBack: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    verificationVideo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    verificationSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verificationReviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verificationRejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    newmessage: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    newlikes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    tester: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    createdAt: true,
    updatedAt: true,
    tableName: "users",
    timestamps: true,
  }
);

export default User;

